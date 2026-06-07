import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Job } from 'bullmq';
import type { TranscodeJobData } from '@vire/core';

const h = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  lastUpdateSet: undefined as unknown,
  downloadToFile: vi.fn(),
  uploadFile: vi.fn(),
  transcodeToHls: vi.fn(),
  computeWaveformPeaks: vi.fn(),
  probeDuration: vi.fn(),
  readAudioMetadata: vi.fn(),
  txUpdate: vi.fn(),
  txInsert: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(h.selectRows) }) }),
    }),
    transaction: (cb: (tx: unknown) => Promise<void>) =>
      cb({ update: h.txUpdate, insert: h.txInsert }),
  },
  tracks: { id: 'tracks.id', status: 'tracks.status' },
  trackAudio: { trackId: 'trackAudio.trackId' },
}));
vi.mock('@vire/core', () => ({ QUEUE_TRANSCODE: 'transcode' }));
vi.mock('../lib/s3.js', () => ({
  VAULT: 'vire-vault',
  STREAM: 'vire-stream',
  downloadToFile: h.downloadToFile,
  uploadFile: h.uploadFile,
}));
vi.mock('../lib/ffmpeg.js', () => ({
  transcodeToHls: h.transcodeToHls,
  computeWaveformPeaks: h.computeWaveformPeaks,
  probeDuration: h.probeDuration,
}));
vi.mock('../lib/metadata.js', () => ({ readAudioMetadata: h.readAudioMetadata }));
vi.mock('../queues/connection.js', () => ({ connection: {} }));

import { processTranscodeJob } from './transcode.worker.js';

const TRACK_ID = '20804250-9bb2-48dc-8af5-a4a6fd54ab06';

function makeJob(): Job<TranscodeJobData> {
  return {
    data: { trackId: TRACK_ID, sourceKey: `tracks/${TRACK_ID}/source.wav` },
    log: vi.fn(),
    updateProgress: vi.fn(),
  } as unknown as Job<TranscodeJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.selectRows = [{ status: 'PROCESSING' }];
  h.lastUpdateSet = undefined;
  h.txUpdate.mockImplementation(() => ({
    set: (v: unknown) => {
      h.lastUpdateSet = v;
      return { where: () => Promise.resolve() };
    },
  }));
  h.txInsert.mockImplementation(() => ({
    values: () => ({ onConflictDoUpdate: () => Promise.resolve() }),
  }));
  h.transcodeToHls.mockResolvedValue({
    manifestPath: '/tmp/x/hls/index.m3u8',
    segmentPaths: ['/tmp/x/hls/chunk_000.ts', '/tmp/x/hls/chunk_001.ts'],
  });
  h.computeWaveformPeaks.mockResolvedValue([0.1, 0.2]);
  h.readAudioMetadata.mockResolvedValue({ durationSec: 200, bpm: 120, musicalKey: 'Am' });
  h.probeDuration.mockResolvedValue(321);
});

describe('processTranscodeJob', () => {
  it('throws when the track does not exist', async () => {
    h.selectRows = [];
    await expect(processTranscodeJob(makeJob())).rejects.toThrow(/Track not found/);
    expect(h.downloadToFile).not.toHaveBeenCalled();
  });

  it('is idempotent: skips a track already READY', async () => {
    h.selectRows = [{ status: 'READY' }];
    const job = makeJob();
    await processTranscodeJob(job);
    expect(job.log).toHaveBeenCalledWith('Already processed, skipping');
    expect(h.downloadToFile).not.toHaveBeenCalled();
    expect(h.transcodeToHls).not.toHaveBeenCalled();
    expect(h.txUpdate).not.toHaveBeenCalled();
  });

  it('downloads the master from the vault using its real extension', async () => {
    await processTranscodeJob(makeJob());
    expect(h.downloadToFile).toHaveBeenCalledTimes(1);
    const [bucket, key, dest] = (h.downloadToFile as Mock).mock.calls[0];
    expect(bucket).toBe('vire-vault');
    expect(key).toBe(`tracks/${TRACK_ID}/source.wav`);
    expect(dest).toMatch(/source\.wav$/);
  });

  it('uploads the HLS manifest and every segment to the stream bucket', async () => {
    await processTranscodeJob(makeJob());

    const calls = (h.uploadFile as Mock).mock.calls;
    const manifest = calls.find((c) => c[1].endsWith('index.m3u8'));
    expect(manifest).toEqual([
      'vire-stream',
      `tracks/${TRACK_ID}/hls/index.m3u8`,
      '/tmp/x/hls/index.m3u8',
      'application/vnd.apple.mpegurl',
    ]);

    const segments = calls.filter((c) => c[1].endsWith('.ts'));
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual([
      'vire-stream',
      `tracks/${TRACK_ID}/hls/chunk_000.ts`,
      '/tmp/x/hls/chunk_000.ts',
      'video/mp2t',
    ]);
  });

  it('marks the track READY with metadata in a transaction', async () => {
    await processTranscodeJob(makeJob());
    expect(h.txUpdate).toHaveBeenCalledTimes(1);
    expect(h.txInsert).toHaveBeenCalledTimes(1);
    expect(h.lastUpdateSet).toMatchObject({ status: 'READY', durationSec: 200 });
  });

  it('falls back to ffprobe duration when tags have none', async () => {
    h.readAudioMetadata.mockResolvedValue({ durationSec: 0, bpm: null, musicalKey: null });
    await processTranscodeJob(makeJob());
    expect(h.probeDuration).toHaveBeenCalledTimes(1);
    expect(h.lastUpdateSet).toMatchObject({ durationSec: 321 });
  });

  it('reports completion progress', async () => {
    const job = makeJob();
    await processTranscodeJob(job);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });
});
