import { Worker, type Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, tracks, trackAudio, getTrackOwnerContact, type TrackOwnerContact } from '@vire/db';
import { QUEUE_TRANSCODE, type TranscodeJobData } from '@vire/core';
import { VAULT, STREAM, downloadToFile, uploadFile } from '../lib/s3.js';
import { transcodeToHls, computeWaveformPeaks, probeDuration } from '../lib/ffmpeg.js';
import { readAudioMetadata } from '../lib/metadata.js';
import { analyzeAudioFeatures } from '../lib/audio-analysis.js';
import { connection } from '../queues/connection.js';
import { sendMail } from '../lib/mailer.js';

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';

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

function failureEmailHtml(contact: TrackOwnerContact, dashboardUrl: string): string {
  const greeting = contact.name ? `Привет, ${contact.name}!` : 'Привет!';
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">Vire</p>
    <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;line-height:1.3">Не удалось обработать трек</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#aaa">${greeting} При обработке трека <strong style="color:#f5f2eb">«${contact.trackTitle}»</strong> произошла ошибка — мы не смогли подготовить его к воспроизведению после нескольких попыток.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#aaa">Попробуй перезалить файл в дашборде. Если ошибка повторится — напиши нам, разберёмся.</p>
    <a href="${dashboardUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">Открыть релиз →</a>
    <p style="margin:40px 0 0;font-size:12px;color:#444">Это служебное уведомление Vire.</p>
  </div>
</body>
</html>`;
}

/**
 * Обработка ОКОНЧАТЕЛЬНОГО падения транскодинга (после исчерпания всех попыток).
 * Вызывается из transcodeWorker.on('failed') в index.ts. Идемпотентна и
 * best-effort: переводит трек PROCESSING → FAILED (не затирая READY/BLOCKED при
 * гонке) и письмом уведомляет артиста. Никогда не бросает — это хвост обработки
 * ошибки, падать в нём нельзя.
 */
export async function handleTerminalTranscodeFailure(
  job: Job<TranscodeJobData> | undefined,
): Promise<void> {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < maxAttempts) return; // ещё будут ретраи — не финал

  const { trackId } = job.data;
  try {
    // FAILED ставим только если трек всё ещё в PROCESSING: поздний успешный
    // ретрай или ручное вмешательство (READY/BLOCKED) не перетираем.
    const updated = await db
      .update(tracks)
      .set({ status: 'FAILED', updatedAt: new Date() })
      .where(and(eq(tracks.id, trackId), eq(tracks.status, 'PROCESSING')))
      .returning({ id: tracks.id });

    if (updated.length === 0) return;

    const contact = await getTrackOwnerContact(trackId);
    if (contact?.email) {
      await sendMail({
        to: contact.email,
        toName: contact.name,
        subject: `Не удалось обработать трек «${contact.trackTitle}»`,
        html: failureEmailHtml(contact, `${APP_URL}/dashboard/releases/${contact.releaseId}`),
      });
      await job.log(`Artist notified at ${contact.email}`);
    }
  } catch (err) {
    // Логируем в job, но не бросаем — иначе зациклим обработку падения.
    await job.log(`handleTerminalTranscodeFailure error: ${(err as Error).message}`);
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
