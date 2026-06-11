import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, tracks, trackAudio } from '@vire/db';
import { QUEUE_TRANSCODE, type TranscodeJobData } from '@vire/core';
import { VAULT, STREAM, downloadToFile, uploadFile } from '../lib/s3.js';
import { transcodeToHls, computeWaveformPeaks, probeDuration } from '../lib/ffmpeg.js';
import { readAudioMetadata } from '../lib/metadata.js';
import { analyzeAudioFeatures } from '../lib/audio-analysis.js';
import { connection } from '../queues/connection.js';

export async function processTranscodeJob(job: Job<TranscodeJobData>): Promise<void> {
  const { trackId, sourceKey } = job.data;

  // Идемпотентность: если трек уже обработан — ничего не делаем
  const [track] = await db
    .select({ status: tracks.status })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!track) throw new Error(`Track not found: ${trackId}`);
  if (track.status === 'READY') {
    await job.log('Already processed, skipping');
    return;
  }

  // Исходник лежит в vault под реальным расширением (wav | flac)
  const sourceExt = sourceKey.split('.').pop() || 'flac';

  const tmpDir = mkdtempSync(path.join(tmpdir(), `vire-${trackId}-`));
  try {
    // 1. Скачиваем мастер из vault
    const sourcePath = path.join(tmpDir, `source.${sourceExt}`);
    await downloadToFile(VAULT, sourceKey, sourcePath);
    await job.updateProgress(20);

    // 2. Читаем метаданные из тегов файла
    const metadata = await readAudioMetadata(sourcePath);
    // Если теги не содержат duration — берём из ffprobe
    const durationSec = metadata.durationSec || (await probeDuration(sourcePath));
    await job.updateProgress(30);

    // 3. Автоопределение BPM/тональности (всегда, перезаписывает теги)
    const analyzed = await analyzeAudioFeatures(sourcePath, { bpm: true, key: true });
    const bpm = analyzed.bpm ?? metadata.bpm;
    const musicalKey = analyzed.musicalKey ?? metadata.musicalKey;
    await job.updateProgress(45);

    // 4. HLS-транскодинг
    const hlsDir = path.join(tmpDir, 'hls');
    mkdirSync(hlsDir);
    const { manifestPath, segmentPaths } = await transcodeToHls(sourcePath, hlsDir);
    await job.updateProgress(75);

    // 5. Waveform peaks
    const waveformPeaks = await computeWaveformPeaks(sourcePath);
    await job.updateProgress(88);

    // 6. S3-ключи. Исходник уже на постоянном ключе (sourceKey) — отдаём его как есть.
    const hlsManifestKey = `tracks/${trackId}/hls/index.m3u8`;
    const sourceVaultKey = sourceKey;

    // 7. Загружаем HLS-файлы в stream-бакет
    await uploadFile(STREAM, hlsManifestKey, manifestPath, 'application/vnd.apple.mpegurl');
    for (const seg of segmentPaths) {
      await uploadFile(
        STREAM,
        `tracks/${trackId}/hls/${path.basename(seg)}`,
        seg,
        'video/mp2t',
      );
    }
    await job.updateProgress(95);

    // 8. Атомарно обновляем БД (flacKey хранит ключ исходного мастера — wav или flac)
    await db.transaction(async (tx) => {
      await tx
        .update(tracks)
        .set({ status: 'READY', durationSec, updatedAt: new Date() })
        .where(eq(tracks.id, trackId));

      await tx
        .insert(trackAudio)
        .values({
          trackId,
          hlsManifestKey,
          waveformPeaks,
          flacKey: sourceVaultKey,
          bpm,
          musicalKey,
        })
        .onConflictDoUpdate({
          target: trackAudio.trackId,
          set: {
            hlsManifestKey,
            waveformPeaks,
            flacKey: sourceVaultKey,
            bpm,
            musicalKey,
            updatedAt: new Date(),
          },
        });
    });

    await job.updateProgress(100);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function createTranscodeWorker() {
  // defaultJobOptions — опция Queue, не Worker; retry задаётся при постановке задачи в очередь
  const worker = new Worker<TranscodeJobData>(QUEUE_TRANSCODE, processTranscodeJob, {
    connection,
    concurrency: 2,
  });

  return worker;
}
