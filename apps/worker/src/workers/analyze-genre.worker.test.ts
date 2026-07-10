import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { AnalyzeGenreJobData } from '@vire/core';

const h = vi.hoisted(() => ({
  getTrackSourceKey: vi.fn(),
  setTrackGenresIfEmpty: vi.fn(),
  saveGenreSuggestions: vi.fn(),
  downloadToFile: vi.fn(),
  classifyTrackGenreOnDemand: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  getTrackSourceKey: h.getTrackSourceKey,
  setTrackGenresIfEmpty: h.setTrackGenresIfEmpty,
  saveGenreSuggestions: h.saveGenreSuggestions,
}));
vi.mock('@vire/core', () => ({ QUEUE_ANALYZE_GENRE: 'analyze-genre' }));
vi.mock('../lib/s3.js', () => ({
  VAULT: 'vire-vault',
  downloadToFile: h.downloadToFile,
}));
vi.mock('../lib/genre-classifier.js', () => ({
  classifyTrackGenreOnDemand: h.classifyTrackGenreOnDemand,
}));
vi.mock('../queues/connection.js', () => ({ connection: {} }));

import { processAnalyzeGenreJob } from './analyze-genre.worker.js';

const TRACK_ID = 'e6f0a3d0-9d3c-4d9a-8f6e-6e6f5c4b3a21';

function makeJob(): Job<AnalyzeGenreJobData> {
  return {
    data: { trackId: TRACK_ID },
    log: vi.fn(),
  } as unknown as Job<AnalyzeGenreJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getTrackSourceKey.mockResolvedValue(`tracks/${TRACK_ID}/source.flac`);
  h.classifyTrackGenreOnDemand.mockResolvedValue([
    { genre: 'TECHNO', confidence: 0.8 },
    { genre: 'HOUSE', confidence: 0.3 },
  ]);
  h.downloadToFile.mockResolvedValue(undefined);
  h.saveGenreSuggestions.mockResolvedValue(undefined);
  h.setTrackGenresIfEmpty.mockResolvedValue(true);
});

describe('processAnalyzeGenreJob', () => {
  it('throws when the track has no source in the vault', async () => {
    h.getTrackSourceKey.mockResolvedValue(null);
    await expect(processAnalyzeGenreJob(makeJob())).rejects.toThrow(/No source/);
    expect(h.downloadToFile).not.toHaveBeenCalled();
  });

  it('downloads the source with its real extension and saves suggestions', async () => {
    await processAnalyzeGenreJob(makeJob());

    expect(h.downloadToFile).toHaveBeenCalledTimes(1);
    const [bucket, key, dest] = h.downloadToFile.mock.calls[0];
    expect(bucket).toBe('vire-vault');
    expect(key).toBe(`tracks/${TRACK_ID}/source.flac`);
    expect(dest).toMatch(/source\.flac$/);

    expect(h.saveGenreSuggestions).toHaveBeenCalledWith(TRACK_ID, [
      { genre: 'TECHNO', confidence: 0.8 },
      { genre: 'HOUSE', confidence: 0.3 },
    ]);
  });

  it('auto-applies top suggestions through the atomic empty-genres guard', async () => {
    await processAnalyzeGenreJob(makeJob());
    expect(h.setTrackGenresIfEmpty).toHaveBeenCalledWith(TRACK_ID, ['TECHNO', 'HOUSE']);
  });

  // "Уже есть жанры — не трогаем" теперь проверяется атомарно в setTrackGenresIfEmpty
  // (INSERT ... WHERE NOT EXISTS), не в этом воркере — здесь только политика отбора
  // кандидатов по confidence.
  it('does not call the atomic guard when the policy picks no candidates', async () => {
    h.classifyTrackGenreOnDemand.mockResolvedValue([{ genre: 'TECHNO', confidence: 0.01 }]);
    await processAnalyzeGenreJob(makeJob());
    expect(h.setTrackGenresIfEmpty).not.toHaveBeenCalled();
  });

  it('propagates classifier errors (e.g. missing model) so the job fails', async () => {
    h.classifyTrackGenreOnDemand.mockRejectedValue(new Error('model not found'));
    await expect(processAnalyzeGenreJob(makeJob())).rejects.toThrow(/model not found/);
    expect(h.saveGenreSuggestions).not.toHaveBeenCalled();
  });

  it('cleans up the temp dir even when classification fails', async () => {
    const { existsSync } = await import('node:fs');
    const path = await import('node:path');
    let tmpDir = '';
    h.downloadToFile.mockImplementation(async (_bucket: string, _key: string, dest: string) => {
      tmpDir = path.dirname(dest);
    });
    h.classifyTrackGenreOnDemand.mockRejectedValue(new Error('boom'));

    await expect(processAnalyzeGenreJob(makeJob())).rejects.toThrow();

    expect(tmpDir).not.toBe('');
    expect(existsSync(tmpDir)).toBe(false);
  });
});
