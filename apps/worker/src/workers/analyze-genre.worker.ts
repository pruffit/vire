import { Worker, type Job } from 'bullmq';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getTrackSourceKey, getTrackGenres, setTrackGenres, saveGenreSuggestions } from '@vire/db';
import { QUEUE_ANALYZE_GENRE, type AnalyzeGenreJobData } from '@vire/core';
import { VAULT, downloadToFile } from '../lib/s3.js';
import { classifyTrackGenreOnDemand } from '../lib/genre-classifier.js';
import { decideAutoApplyGenres } from '../lib/genre-policy.js';
import { connection } from '../queues/connection.js';

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

    const existingGenres = await getTrackGenres(trackId);
    const autoApply = decideAutoApplyGenres(existingGenres, suggestions);
    if (autoApply.length > 0) await setTrackGenres(trackId, autoApply);

    await job.log(`suggestions=${suggestions.map((s) => s.genre).join(',')} autoApplied=${autoApply.join(',')}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function createAnalyzeGenreWorker() {
  return new Worker<AnalyzeGenreJobData>(QUEUE_ANALYZE_GENRE, processAnalyzeGenreJob, {
    connection,
    concurrency: 1,
  });
}
