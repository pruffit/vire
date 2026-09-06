import { Worker, type Job } from 'bullmq';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getTrackSourceKey, setTrackGenresIfEmpty, saveGenreSuggestions } from '@vire/db';
import { QUEUE_ANALYZE_GENRE, type AnalyzeGenreJobData } from '@vire/core';
import { VAULT, downloadToFile } from '../lib/s3.js';
import { classifyTrackGenreOnDemand } from '../lib/genre-classifier.js';
import { decideAutoApplyGenres } from '../lib/genre-policy.js';
import { baseWorkerOptions } from '../queues/worker-options.js';

export async function processAnalyzeGenreJob(job: Job<AnalyzeGenreJobData>): Promise<void> {
  const { trackId } = job.data;

  const sourceKey = await getTrackSourceKey(trackId);
  if (!sourceKey) throw new Error(`No source in vault for track ${trackId}`);

  const ext = sourceKey.split('.').pop() || 'flac';
  const tmpDir = mkdtempSync(path.join(tmpdir(), `vire-genre-${trackId}-`));
  try {
    const sourcePath = path.join(tmpDir, `source.${ext}`);
    await downloadToFile(VAULT, sourceKey, sourcePath);

    const suggestions = await classifyTrackGenreOnDemand(sourcePath);
    await saveGenreSuggestions(trackId, suggestions);

    const autoApply = decideAutoApplyGenres(suggestions);
    if (autoApply.length > 0) await setTrackGenresIfEmpty(trackId, autoApply);

    await job.log(`suggestions=${suggestions.map((s) => s.genre).join(',')} autoApplied=${autoApply.join(',')}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// onnxruntime-node .run() синхронный (не в libuv threadpool) — блокирует event loop
// дольше дефолтного 30с-лока на 1ГБ VPS, job считается stalled. 10 минут — запас.
const LOCK_DURATION_MS = 10 * 60 * 1000;

export function createAnalyzeGenreWorker() {
  return new Worker<AnalyzeGenreJobData>(QUEUE_ANALYZE_GENRE, processAnalyzeGenreJob, {
    ...baseWorkerOptions,
    concurrency: 1,
    lockDuration: LOCK_DURATION_MS,
  });
}
