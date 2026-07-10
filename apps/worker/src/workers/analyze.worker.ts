import { Worker, type Job } from 'bullmq';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, trackAudio } from '@vire/db';
import { eq } from 'drizzle-orm';
import { QUEUE_ANALYZE, type AnalyzeJobData } from '@vire/core';
import { VAULT, downloadToFile } from '../lib/s3.js';
import { analyzeAudioFeatures } from '../lib/audio-analysis.js';
import { connection } from '../queues/connection.js';

export async function processAnalyzeJob(job: Job<AnalyzeJobData>): Promise<void> {
  const { trackId, flacKey } = job.data;

  const ext = flacKey.split('.').pop() || 'flac';
  const tmpDir = mkdtempSync(path.join(tmpdir(), `vire-analyze-${trackId}-`));
  try {
    const sourcePath = path.join(tmpDir, `source.${ext}`);
    await downloadToFile(VAULT, flacKey, sourcePath);

    const { bpm, musicalKey } = await analyzeAudioFeatures(sourcePath, { bpm: true, key: true });

    await db
      .update(trackAudio)
      .set({ bpm, musicalKey, bpmKeyAnalyzedAt: new Date(), updatedAt: new Date() })
      .where(eq(trackAudio.trackId, trackId));

    await job.log(`bpm=${bpm ?? 'null'} key=${musicalKey ?? 'null'}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// lockDuration поднят с дефолтных 30с: detectBPM/detectKey — чистые синхронные JS-циклы
// (Goertzel по каждому кадру × 12 тонов × ~5 октав) без единого await, блокируют event
// loop на весь анализ трека. На 1ГБ VPS под нагрузкой/свопом это может занять больше
// дефолтного окна лока → «could not renew lock» / «Missing lock ... moveToFinished»
// (см. прод-алерты analyze/analyze-genre). 10 минут — запас над реальным временем.
const LOCK_DURATION_MS = 10 * 60 * 1000;

export function createAnalyzeWorker() {
  return new Worker<AnalyzeJobData>(QUEUE_ANALYZE, processAnalyzeJob, {
    connection,
    concurrency: 1, // анализ тяжёлый, не параллелим
    lockDuration: LOCK_DURATION_MS,
  });
}
