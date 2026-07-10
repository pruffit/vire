import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Job } from 'bullmq';
import type { TranscodeJobData } from '@vire/core';

const h = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  lastUpdateSet: undefined as unknown,
  updateReturning: [] as unknown[],
  downloadToFile: vi.fn(),
  uploadFile: vi.fn(),
  transcodeToHls: vi.fn(),
  computeWaveformPeaks: vi.fn(),
  probeDuration: vi.fn(),
  readAudioMetadata: vi.fn(),
  analyzeAudioFeatures: vi.fn(),
  txUpdate: vi.fn(),
  txInsert: vi.fn(),
  dbUpdate: vi.fn(),
  getTrackOwnerContact: vi.fn(),
  sendMail: vi.fn(),
  classifyTrackGenre: vi.fn(),
  decideAutoApplyGenres: vi.fn(),
  setTrackGenresIfEmpty: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(h.selectRows) }) }),
    }),
    update: h.dbUpdate,
    transaction: (cb: (tx: unknown) => Promise<void>) =>
      cb({ update: h.txUpdate, insert: h.txInsert }),
  },
  tracks: { id: 'tracks.id', status: 'tracks.status' },
  trackAudio: { trackId: 'trackAudio.trackId' },
  getTrackOwnerContact: h.getTrackOwnerContact,
  setTrackGenresIfEmpty: h.setTrackGenresIfEmpty,
}));
vi.mock('@vire/core', () => ({ QUEUE_TRANSCODE: 'transcode' }));
vi.mock('../lib/mailer.js', () => ({ sendMail: h.sendMail }));
vi.mock('../lib/genre-classifier.js', () => ({ classifyTrackGenre: h.classifyTrackGenre }));
vi.mock('../lib/genre-policy.js', () => ({ decideAutoApplyGenres: h.decideAutoApplyGenres }));
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
vi.mock('../lib/audio-analysis.js', () => ({ analyzeAudioFeatures: h.analyzeAudioFeatures }));
vi.mock('../queues/connection.js', () => ({ connection: {} }));

import { processTranscodeJob, handleTerminalTranscodeFailure } from './transcode.worker.js';

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
  h.analyzeAudioFeatures.mockResolvedValue({ bpm: 120, musicalKey: 'A minor' });
  h.probeDuration.mockResolvedValue(321);

  // Хвост обработки падения: db.update(...).set(...).where(...).returning(...)
  h.updateReturning = [{ id: TRACK_ID }];
  h.dbUpdate.mockImplementation(() => ({
    set: () => ({ where: () => ({ returning: () => Promise.resolve(h.updateReturning) }) }),
  }));
  h.getTrackOwnerContact.mockResolvedValue({
    email: 'artist@example.com',
    name: 'Artist',
    trackTitle: 'Song',
    releaseId: 'rel-1',
    artistSlug: 'artist',
  });
  h.sendMail.mockResolvedValue(undefined);

  // По умолчанию — как при выключенном AUTO_GENRE: классификатор ничего не даёт.
  h.classifyTrackGenre.mockResolvedValue(null);
  h.decideAutoApplyGenres.mockReturnValue([]);
  h.setTrackGenresIfEmpty.mockResolvedValue(false);
});

function makeFailJob(over?: { attemptsMade?: number; attempts?: number }): Job<TranscodeJobData> {
  return {
    data: { trackId: TRACK_ID, sourceKey: `tracks/${TRACK_ID}/source.wav` },
    log: vi.fn(),
    attemptsMade: over?.attemptsMade ?? 3,
    opts: { attempts: over?.attempts ?? 3 },
  } as unknown as Job<TranscodeJobData>;
}

describe('handleTerminalTranscodeFailure', () => {
  it('does nothing while retries remain', async () => {
    await handleTerminalTranscodeFailure(makeFailJob({ attemptsMade: 1, attempts: 3 }));
    expect(h.dbUpdate).not.toHaveBeenCalled();
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it('marks the track FAILED and emails the artist on the final attempt', async () => {
    await handleTerminalTranscodeFailure(makeFailJob({ attemptsMade: 3, attempts: 3 }));
    expect(h.dbUpdate).toHaveBeenCalledTimes(1);
    expect(h.sendMail).toHaveBeenCalledTimes(1);
    const arg = (h.sendMail as Mock).mock.calls[0][0];
    expect(arg.to).toBe('artist@example.com');
    expect(arg.subject).toContain('Song');
  });

  it('does not email when the track was no longer PROCESSING (race with success)', async () => {
    h.updateReturning = [];
    await handleTerminalTranscodeFailure(makeFailJob({ attemptsMade: 3, attempts: 3 }));
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it('never throws if notifying the artist fails', async () => {
    h.sendMail.mockRejectedValue(new Error('brevo down'));
    await expect(
      handleTerminalTranscodeFailure(makeFailJob({ attemptsMade: 3, attempts: 3 })),
    ).resolves.toBeUndefined();
  });
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

  it('always runs audio analysis regardless of tag values', async () => {
    await processTranscodeJob(makeJob());
    expect(h.analyzeAudioFeatures).toHaveBeenCalledWith(
      expect.stringMatching(/source\.wav$/),
      { bpm: true, key: true },
    );
  });

  it('falls back to ffprobe duration when tags have none', async () => {
    h.readAudioMetadata.mockResolvedValue({ durationSec: 0, bpm: null, musicalKey: null });
    await processTranscodeJob(makeJob());
    expect(h.probeDuration).toHaveBeenCalledTimes(1);
    expect(h.lastUpdateSet).toMatchObject({ durationSec: 321 });
  });

  it('falls back to tag bpm/key when analysis returns null', async () => {
    h.readAudioMetadata.mockResolvedValue({ durationSec: 180, bpm: 140, musicalKey: 'Dm' });
    h.analyzeAudioFeatures.mockResolvedValue({ bpm: null, musicalKey: null });
    await processTranscodeJob(makeJob());
    expect(h.txUpdate).toHaveBeenCalledTimes(1);
  });

  it('reports completion progress', async () => {
    const job = makeJob();
    await processTranscodeJob(job);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('applies auto-genre atomically when the policy picks candidates', async () => {
    h.classifyTrackGenre.mockResolvedValue([{ genre: 'TECHNO', confidence: 0.5 }]);
    h.decideAutoApplyGenres.mockReturnValue(['TECHNO']);
    h.setTrackGenresIfEmpty.mockResolvedValue(true);

    const job = makeJob();
    await processTranscodeJob(job);

    expect(h.decideAutoApplyGenres).toHaveBeenCalledWith([{ genre: 'TECHNO', confidence: 0.5 }]);
    expect(h.setTrackGenresIfEmpty).toHaveBeenCalledWith(TRACK_ID, ['TECHNO']);
  });

  it('does not touch track_genres when the policy returns no candidates', async () => {
    h.classifyTrackGenre.mockResolvedValue([{ genre: 'TECHNO', confidence: 0.5 }]);
    h.decideAutoApplyGenres.mockReturnValue([]);

    await processTranscodeJob(makeJob());

    expect(h.setTrackGenresIfEmpty).not.toHaveBeenCalled();
  });

  it('skips genre policy entirely when the classifier returns no suggestions', async () => {
    h.classifyTrackGenre.mockResolvedValue(null);

    await processTranscodeJob(makeJob());

    expect(h.decideAutoApplyGenres).not.toHaveBeenCalled();
    expect(h.setTrackGenresIfEmpty).not.toHaveBeenCalled();
  });
});
