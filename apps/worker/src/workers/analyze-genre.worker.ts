import { Worker, type Job } from 'bullmq';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getTrackSourceKey, setTrackGenresIfEmpty, saveGenreSuggestions } from '@vire/db';
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

    const autoApply = decideAutoApplyGenres(suggestions);
    if (autoApply.length > 0) await setTrackGenresIfEmpty(trackId, autoApply);

    await job.log(`suggestions=${suggestions.map((s) => s.genre).join(',')} autoApplied=${autoApply.join(',')}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// lockDuration поднят с дефолтных 30с: classify() гоняет ONNX-инференс
// (onnxruntime-node .run() выполняется синхронно в JS-потоке, не в libuv threadpool)
// на «тяжёлом» 1ГБ VPS — блокирует event loop дольше дефолтного окна лока, таймер
// продления не успевает тикнуть → «could not renew lock» → job считается stalled и
// дублируется/перезапускается. 10 минут — с большим запасом над реальным временем
// инференса; lockRenewTime по умолчанию = lockDuration/2.
const LOCK_DURATION_MS = 10 * 60 * 1000;

export function createAnalyzeGenreWorker() {
  return new Worker<AnalyzeGenreJobData>(QUEUE_ANALYZE_GENRE, processAnalyzeGenreJob, {
    connection,
    concurrency: 1,
    lockDuration: LOCK_DURATION_MS,
  });
}
