# Релизы и треки (загрузка, транскодинг, статусы)

## Что делает

Артист создаёт релиз (EP/LP/сингл), загружает FLAC/WAV, воркер транскодирует в HLS. Плеер работает только через HLS-манифест.

### Жизненный цикл трека

```
Загрузка FLAC/WAV → S3 (vault/tracks/{track_id}/source.flac)
        ↓
BullMQ: очередь "transcode"
        ↓
apps/worker: ffmpeg → HLS-чанки (.ts) + manifest (.m3u8) → S3
             ffprobe → waveform peaks (JSONB) → DB
        ↓
track_audio.status: PROCESSING → READY (или BLOCKED при ошибке)
```

### Статусы трека (`track_audio.status`)
- `PROCESSING` — загружен, воркер ещё не завершил
- `READY` — HLS-манифест есть, трек можно слушать
- `BLOCKED` — ошибка транскодинга или ручная блокировка модератором

### Статусы релиза (`releases.status`)
- `DRAFT` — виден только в дашборде
- `PUBLISHED` — публичен немедленно
- `SCHEDULED` — публичен с `published_at` (UTC)

## Где код

- **Загрузка файла (API):** `apps/web/app/api/v1/dashboard/releases/[id]/tracks/upload/route.ts`
- **Создание/редактирование релиза (API):** `apps/web/app/api/v1/dashboard/releases/route.ts` и `[id]/route.ts`
- **Смена статуса релиза:** `apps/web/app/api/v1/dashboard/releases/[id]/status/route.ts`
- **Кнопка публикации:** `apps/web/app/dashboard/releases/[id]/_components/PublishButton.tsx`
- **Воркер транскодинга:** `apps/worker/src/workers/transcode.worker.ts`
- **Пайплайн HLS:** `apps/worker/src/lib/ffmpeg.ts`
- **Waveform peaks:** `apps/worker/src/lib/waveform.ts` — `peaksFromPcm`
- **Сервисы:** `packages/core/src/services/release.service.ts`, `track.service.ts`
- **DB таблицы:**
  - `releases` — `status`, `published_at`, `artist_profile_id`
  - `tracks` — метаданные
  - `track_audio` — `status`, `hls_manifest_key`, `waveform_peaks` JSONB, `duration_ms`
  - `track_contributors` — `payout_share numeric(5,2)`

## Нюансы ffmpeg-пайплайна

Флаги в `apps/worker/src/lib/ffmpeg.ts`, без которых HLS у части исходников ломается:

- `+genpts` — у некоторых FLAC/WAV битые PTS, без регенерации сегменты получают
  рваные таймстемпы
- `-vn` — встроенная обложка (FLAC/MP3 attached picture) декодируется как
  фейковая видеодорожка и подвешивает транскод
- `aresample=async=1:first_pts=0` — дыры в аудио-таймстемпах дают
  `bufferStalledError` в hls.js на воспроизведении

## Env-переменные

```
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_PUBLIC_ENDPOINT=
REDIS_URL=                      # BullMQ-очередь
```

## Известные ограничения

- Без запущенного воркера трек навсегда остаётся `PROCESSING`; `pnpm dev` из корня запускает и web, и worker
- Нельзя вручную поставить статус `READY` — у трека не будет HLS-манифеста, плеер откажет
- Маркер `!hls` в админке (`/admin/tracks`) показывает треки с `READY` но без манифеста
- FLAC отдаётся только по presigned S3 URL после покупки (Этап 2)
