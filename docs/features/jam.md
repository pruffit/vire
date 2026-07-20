# Джем-сессии

Совместная комната для тусовок: несколько человек (включая гостей без аккаунта)
подключаются по коду/ссылке/QR к общей очереди треков и слышат одно и то же
в одну секунду. Спека: `docs/superpowers/specs/2026-07-20-jam-sessions-design.md`.

## Что делает

- Хост (залогиненный) создаёт джем на `/jam`, делится кодом (6 симв., алфавит без
  похожих глифов), ссылкой или QR. Гость входит по ссылке с именем — аккаунт не нужен,
  идентичность — подписанный `sessionId` (`lib/session-signing.ts`).
- Общая очередь синхронна у всех через SSE: мутации — намерения (add/remove/move),
  сервер применяет к текущему состоянию, поднимает `queue_version` (Postgres, та же
  транзакция) и рассылает полную очередь; клиент применяет только если `version` больше
  локальной, при активном drag буферизует.
- Синхронное воспроизведение: сервер-авторитетные часы (`GET /api/v1/jam/time`,
  5 NTP-замеров, минимальный RTT, ресинк 5 мин). Позиция выводится из
  `{ trackId, startedAtMs, paused, pausedPositionMs }` в Redis, а не транслируется.
  Дрейф: >2с — жёсткий seek; 150мс–2с — `playbackRate = 1 ± 0.03` до схождения <50мс
  (гистерезис); `preservesPitch`. Отдельный аудио-движок `lib/jam/jam-audio.ts`
  (глобальный плеер ставится на паузу). Вход в звук — явный тап (автоплей-политика).
- Права: транспорт (play/pause/seek/next), удаление любого трека, кик, закрытие —
  только HOST; добавлять/двигать треки — любой участник. Автопереход по `ended`
  инициирует хост.
- Лимиты: очередь ≤200, участники ≤50, добавления 10/мин (Redis-счётчик);
  авто-закрытие после 12ч без активности — воркер `jam-reaper` (каждые 15 мин,
  порог интервалом в SQL).
- «Сохранить в плейлист» — залогиненный участник сохраняет очередь себе
  (`PlaylistService.create` + `addTrack`); при сохранении хостом пишется
  `jam_sessions.saved_playlist_id`.
- Приглашение друзей — уведомление `JAM_INVITE` в колокольчик (+realtime), ссылка
  ведёт на `/jam/id/{jamId}` → серверный редирект на комнату по коду.

## Где код

- **Страницы:** `app/(listener)/jam/page.tsx` (вход: создать/войти по коду),
  `jam/[code]/` (комната: `jam-room`, `jam-join`, `jam-add-panel`, `jam-participants`,
  `jam-save-playlist`), `jam/id/[jamId]` (редирект из уведомления)
- **API:** `app/api/v1/jam/route.ts` (создание), `jam/time`,
  `jam/[code]/{join,queue,playback,heartbeat,end,stream,qr,save-playlist,invite}`,
  `GET /api/v1/friends` (список друзей для инвайта)
- **Сервисы/логика:** `packages/core/src/services/{jam,jam-sync,jam-code}.ts`
  (чистые: права, лимиты, `applyQueueMutation`, `derivePositionMs`,
  `decideDriftCorrection`, `pickClockOffset`), порт `ports/jam-state.ts`;
  `apps/web/lib/jam/*` (`server-clock`, `jam-audio`, `use-jam-room`, `use-jam-queue`,
  `use-playback-sync`, `jam-state`, `jam-identity`, `guest-name`);
  `lib/realtime.ts` — `publishChannel`/`subscribeChannel`, канал `rt:jam:{id}`;
  `components/jam-share.tsx`, `components/jam-invite.tsx`
- **Воркер:** `apps/worker/src/workers/jam-reaper.worker.ts` +
  `lib/jam-cleanup.ts` (Redis-ключи и `jam:ended` — те же, что у web)
- **Данные:** `packages/db/src/schema/jam.ts` — `jam_sessions` / `jam_participants`
  (check «ровно одна идентичность»: user XOR guest) / `jam_queue_items`
  (миграция 0042; `JAM_INVITE` в enum уведомлений — 0043).
  Redis: `jam:{id}:playback`, `jam:{id}:presence`, `jam:{id}:adds:{participant}` (TTL)

## Env

- Не требуется нового: `REDIS_URL`, `NEXT_PUBLIC_SITE_URL` (QR/ссылки) уже есть.

## Ограничения / на будущее

- Вне v1: голосование за треки, несколько хостов, видео/чат внутри джема.
- Redis лёг → тихая деградация: очередь живёт в Postgres, синхро-позиция и presence
  не работают, добавления не блокируются лимитером.
- Дубли трека в очереди осознанно разрешены (`unique(jam_id, track_id)` нет).
- Гость без аккаунта не может сохранить плейлист и не получает приглашений.
- `saved_playlist_id` — одно на джем (последнее сохранение хостом).
