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

// detectBPM/detectKey — синхронные CPU-циклы без await, блокируют event loop; на 1ГБ VPS
// могут не успеть продлить дефолтный 30с-лок → job считается stalled. 10 минут — запас.
const LOCK_DURATION_MS = 10 * 60 * 1000;

export function createAnalyzeWorker() {
  return new Worker<AnalyzeJobData>(QUEUE_ANALYZE, processAnalyzeJob, {
    connection,
    concurrency: 1, // анализ тяжёлый, не параллелим
    lockDuration: LOCK_DURATION_MS,
  });
}
