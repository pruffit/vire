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
import { connection } from '../queues/connection.js';

async function process(job: Job<TranscodeJobData>): Promise<void> {
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

  const tmpDir = mkdtempSync(path.join(tmpdir(), `vire-${trackId}-`));
  try {
    // 1. Скачиваем FLAC из vault
    const flacPath = path.join(tmpDir, 'source.flac');
    await downloadToFile(VAULT, sourceKey, flacPath);
    await job.updateProgress(20);

    // 2. Читаем метаданные из тегов файла
    const metadata = await readAudioMetadata(flacPath);
    // Если теги не содержат duration — берём из ffprobe
    const durationSec = metadata.durationSec || (await probeDuration(flacPath));
    await job.updateProgress(30);

    // 3. HLS-транскодинг
    const hlsDir = path.join(tmpDir, 'hls');
    mkdirSync(hlsDir);
    const { manifestPath, segmentPaths } = await transcodeToHls(flacPath, hlsDir);
    await job.updateProgress(65);

    // 4. Waveform peaks
    const waveformPeaks = await computeWaveformPeaks(flacPath);
    await job.updateProgress(80);

    // 5. S3-ключи
    const hlsManifestKey = `tracks/${trackId}/hls/index.m3u8`;
    const permanentFlacKey = `tracks/${trackId}/source.flac`;

    // 6. Загружаем HLS-файлы в stream-бакет
    await uploadFile(STREAM, hlsManifestKey, manifestPath, 'application/vnd.apple.mpegurl');
    for (const seg of segmentPaths) {
      await uploadFile(
        STREAM,
        `tracks/${trackId}/hls/${path.basename(seg)}`,
        seg,
        'video/mp2t',
      );
    }

    // 7. Перекладываем FLAC на постоянный ключ (если загружен во временный)
    if (sourceKey !== permanentFlacKey) {
      await uploadFile(VAULT, permanentFlacKey, flacPath, 'audio/flac');
    }
    await job.updateProgress(90);

    // 8. Атомарно обновляем БД
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
          flacKey: permanentFlacKey,
          bpm: metadata.bpm,
          musicalKey: metadata.musicalKey,
        })
        .onConflictDoUpdate({
          target: trackAudio.trackId,
          set: {
            hlsManifestKey,
            waveformPeaks,
            flacKey: permanentFlacKey,
            bpm: metadata.bpm,
            musicalKey: metadata.musicalKey,
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
  const worker = new Worker<TranscodeJobData>(QUEUE_TRANSCODE, process, {
    connection,
    concurrency: 2,
  });

  return worker;
}
