---
name: vire-media
description: Use when working on VireMusic's audio media pipeline — FFmpeg transcoding, HLS segmentation (.m3u8 + .ts chunks), waveform peak extraction, BPM/key analysis, FLAC/WAV master handling, or S3 vault/stream bucket layout. Use for changes in apps/worker (transcode/analyze workers, lib/ffmpeg, lib/waveform, lib/audio-analysis) and anything about how a master becomes a playable HLS stream, signed FLAC downloads, or why a track is stuck in PROCESSING.
version: 1.0.0
user-invocable: true
---

# VireMusic — медиа-конвейер (FFmpeg / HLS / waveform)

Привязка к коду: `apps/worker/src/workers/transcode.worker.ts`,
`apps/worker/src/lib/{ffmpeg,waveform,audio-analysis,metadata,s3}.ts`.
Фича-док: `docs/features/tracks-and-releases.md`, `docs/features/uploads.md`.

## Поток мастер → играбельный стрим

```
Артист льёт FLAC/WAV → S3 vault (приватный) → BullMQ queue `transcode`
   → worker: ffprobe duration → анализ BPM/key → ffmpeg HLS-нарезка
   → waveform peaks → upload HLS в stream-бакет (публичный)
   → транзакция: tracks.status=READY + trackAudio (hlsManifestKey, peaks, flacKey, bpm, key)
```

Стриминг в плеере **только через HLS** (`hls.js`) — никаких прямых ссылок на
mp3/flac. FLAC отдаётся только по **Signed URL** после покупки (Этап 2).

## Ключевые инварианты (`processTranscodeJob`)

1. **Идемпотентность.** Первым делом читаем `tracks.status`; если `READY` —
   `return` (skip). Повторный прогон не ломает готовый трек.
2. **Расширение мастера — из ключа**, не догадки: `sourceKey.split('.').pop()`
   (wav | flac). Исходник лежит на постоянном ключе в vault.
3. **Duration**: сперва из тегов файла (`readAudioMetadata`), fallback —
   `probeDuration` (ffprobe). Не падать, если тегов нет.
4. **BPM/тональность — автоанализ всегда** (`analyzeAudioFeatures`), перезаписывает
   теги; теги — запасной вариант (`analyzed.bpm ?? metadata.bpm`).
5. **HLS**: `transcodeToHls(src, hlsDir)` → `{ manifestPath, segmentPaths }`.
   Манифест → `tracks/{trackId}/hls/index.m3u8` (`application/vnd.apple.mpegurl`),
   сегменты → `tracks/{trackId}/hls/{name}` (`video/mp2t`).
6. **Waveform**: `computeWaveformPeaks` → предрассчитанные пики в
   `track_audio.waveform_peaks` (JSONB). Никакого Web Audio API в плеере.
7. **Атомарная запись в БД** — одна транзакция: `tracks.status=READY` +
   `insert trackAudio ... onConflictDoUpdate` (idемпотентно по `trackId`).
8. **Чистка tmp** — всегда в `finally` (`rmSync(tmpDir, recursive, force)`).

## S3-бакеты

- `VAULT` — приватный, мастера: `vault/tracks/{trackId}/source.{flac|wav}`.
- `STREAM` — публичный, HLS: `tracks/{trackId}/hls/*`.
- Файлы организованы **по track_id, не по артисту** (см. CLAUDE.md / data-schema).

## Падения и статусы

- Финальное падение (после ретраев) обрабатывает `handleTerminalTranscodeFailure`
  из `transcodeWorker.on('failed')`: переводит трек `PROCESSING → FAILED`
  **только если он ещё PROCESSING** (`where status='PROCESSING'`) — поздний успешный
  ретрай/ручной BLOCKED не перетирает. Шлёт письмо артисту (Brevo). **Никогда не
  бросает** — это хвост обработки ошибки.
- Трек висит в `PROCESSING`, очередь копит «в ожидании» → **не запущен worker**
  (`pnpm --filter @vire/worker dev`). Ставить READY руками нельзя — без прогона нет
  HLS-манифеста (в админке маркер `!hls`), плеер скажет «нет файлов».

## Тесты медиа

- `transcode.worker.test.ts` — идемпотентность, derive ext, HLS-загрузка,
  READY-транзакция, fallback на ffprobe.
- `waveform.test.ts` — `peaksFromPcm` (чистая функция над PCM).
- Воркер-логику тестируем чистыми функциями над данными, ffmpeg/S3 — за интерфейсами.
