import { Worker, type Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, tracks, trackAudio, getTrackOwnerContact, setTrackGenresIfEmpty } from '@vire/db';
import {
  QUEUE_TRANSCODE, transcodeFailedEmail, normalizeMediaJob,
  type TranscodeJobData, type ProcessMediaJobData,
} from '@vire/core';
import { isLocale, DEFAULT_LOCALE, type Locale } from '@vire/i18n';
import { VAULT, STREAM, downloadToFile, uploadFile } from '../lib/s3.js';
import { transcodeToHls, computeWaveformPeaks, probeDuration } from '../lib/ffmpeg.js';
import { readAudioMetadata } from '../lib/metadata.js';
import { analyzeAudioFeatures } from '../lib/audio-analysis.js';
import { classifyTrackGenre } from '../lib/genre-classifier.js';
import { decideAutoApplyGenres } from '../lib/genre-policy.js';
import type { GenreSuggestion } from '../lib/discogs-genre-map.js';
import { baseWorkerOptions } from '../queues/worker-options.js';
import { sendMail } from '../lib/mailer.js';
import { createStageTimer } from '../lib/timing.js';

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';

export async function processTranscodeJob(job: Job<TranscodeJobData | ProcessMediaJobData>): Promise<void> {
  const normalized = normalizeMediaJob(job.data);
  if (!normalized) {
    await job.log('Unsupported media job payload, skipping');
    return;
  }
  // assetId сейчас равен trackId: расщепление track_audio на MediaAsset ещё не сделано.
  const { assetId: trackId, sourceKey } = normalized;

  // Идемпотентность: если трек уже обработан, ничего не делаем
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
  const timer = createStageTimer();
  try {
    const sourcePath = path.join(tmpDir, `source.${sourceExt}`);
    await timer.run('download', () => downloadToFile(VAULT, sourceKey, sourcePath));
    await job.updateProgress(20);

    const metadata = await readAudioMetadata(sourcePath);
    // Теги не содержат duration: берём из ffprobe.
    const durationSec = metadata.durationSec || (await probeDuration(sourcePath));
    await job.updateProgress(30);

    // BPM/тональность: всегда, перезаписывает теги.
    // Этап `dsp` — единственный CPU-bound JS в пайплайне, остальные тяжёлые нативные.
    const analyzed = await timer.run('dsp', () => analyzeAudioFeatures(sourcePath, { bpm: true, key: true }));
    const bpm = analyzed.bpm ?? metadata.bpm;
    const musicalKey = analyzed.musicalKey ?? metadata.musicalKey;
    await job.updateProgress(45);

    // За флагом AUTO_GENRE, ошибка не блокирует переход в READY, только логируется.
    let genreSuggestions: GenreSuggestion[] | null = null;
    try {
      genreSuggestions = await timer.run('genre', () => classifyTrackGenre(sourcePath));
      if (genreSuggestions && genreSuggestions.length > 0) {
        const autoApply = decideAutoApplyGenres(genreSuggestions);
        if (autoApply.length > 0) {
          const applied = await setTrackGenresIfEmpty(trackId, autoApply);
          if (applied) await job.log(`Auto-applied genres: ${autoApply.join(', ')}`);
        }
      }
    } catch (e) {
      console.error('[transcode] genre classification failed', e);
    }

    const hlsDir = path.join(tmpDir, 'hls');
    mkdirSync(hlsDir);
    const { manifestPath, segmentPaths } = await timer.run('hls', () => transcodeToHls(sourcePath, hlsDir));
    await job.updateProgress(75);

    const waveformPeaks = await timer.run('waveform', () => computeWaveformPeaks(sourcePath));
    await job.updateProgress(88);

    // Исходник уже на постоянном ключе: отдаём sourceKey как есть.
    const hlsManifestKey = `tracks/${trackId}/hls/index.m3u8`;
    const sourceVaultKey = sourceKey;

    await timer.run('upload', async () => {
      await uploadFile(STREAM, hlsManifestKey, manifestPath, 'application/vnd.apple.mpegurl');
      for (const seg of segmentPaths) {
        await uploadFile(
          STREAM,
          `tracks/${trackId}/hls/${path.basename(seg)}`,
          seg,
          'video/mp2t',
        );
      }
    });
    await job.updateProgress(95);

    // flacKey хранит ключ исходного мастера (wav или flac).
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
          genreSuggestions,
        })
        .onConflictDoUpdate({
          target: trackAudio.trackId,
          set: {
            hlsManifestKey,
            waveformPeaks,
            flacKey: sourceVaultKey,
            bpm,
            musicalKey,
            genreSuggestions,
            updatedAt: new Date(),
          },
        });
    });

    await job.updateProgress(100);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    // В job.log — чтобы разбивка была видна в админке рядом с самим джобом,
    // в stdout — чтобы попадала в journalctl вместе с остальными логами воркера.
    const breakdown = `[transcode] track=${trackId} ${timer.summary()} total=${timer.totalMs()}ms`;
    console.log(breakdown);
    // Замер — диагностика: его сбой не должен подменять настоящую ошибку джоба,
    // ради которой мы попали в finally.
    try { await job.log(breakdown); } catch { /* no-op */ }
  }
}

/**
 * Финальное падение транскодинга (после исчерпания всех попыток), вызывается
 * из transcodeWorker.on('failed'). Идемпотентна и best-effort: PROCESSING → FAILED
 * (не затирая READY/BLOCKED при гонке) + письмо артисту. Никогда не бросает.
 */
export async function handleTerminalTranscodeFailure(
  job: Job<TranscodeJobData | ProcessMediaJobData> | undefined,
): Promise<void> {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < maxAttempts) return; // ещё будут ретраи, не финал

  const normalized = normalizeMediaJob(job.data);
  if (!normalized) return;
  const trackId = normalized.assetId;
  try {
    // FAILED только если трек ещё в PROCESSING: не перетираем поздний READY/BLOCKED.
    const updated = await db
      .update(tracks)
      .set({ status: 'FAILED', updatedAt: new Date() })
      .where(and(eq(tracks.id, trackId), eq(tracks.status, 'PROCESSING')))
      .returning({ id: tracks.id });

    if (updated.length === 0) return;

    const contact = await getTrackOwnerContact(trackId);
    if (contact?.email) {
      const locale: Locale = isLocale(contact.locale ?? '') ? (contact.locale as Locale) : DEFAULT_LOCALE;
      const { subject, html } = await transcodeFailedEmail({
        trackTitle: contact.trackTitle,
        dashboardUrl: `${APP_URL}/dashboard/releases/${contact.releaseId}`,
        recipientName: contact.name,
        locale,
      });
      await sendMail({ to: contact.email, toName: contact.name, subject, html });
      await job.log(`Artist notified at ${contact.email}`);
    }
  } catch (err) {
    // Логируем в job, но не бросаем: иначе зациклим обработку падения.
    await job.log(`handleTerminalTranscodeFailure error: ${(err as Error).message}`);
  }
}

// lockDuration поднят с дефолтных 30с: BPM/key и жанр (JS-циклы, ONNX-инференс)
// блокируют event loop, тот же риск потери лока, что в analyze/analyze-genre.
const LOCK_DURATION_MS = 10 * 60 * 1000;

export function createTranscodeWorker() {
  // defaultJobOptions: опция Queue, не Worker; retry задаётся при постановке задачи в очередь
  const worker = new Worker<TranscodeJobData | ProcessMediaJobData>(QUEUE_TRANSCODE, processTranscodeJob, {
    ...baseWorkerOptions,
    concurrency: 2,
    lockDuration: LOCK_DURATION_MS,
  });

  return worker;
}
