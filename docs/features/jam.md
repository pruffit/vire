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
  (гистерезис); `preservesPitch`. Отдельный аудио-движок `lib/jam/jam-audio.ts`.
  Вход в звук — явный тап (автоплей-политика); `usePlaybackSync` получает
  `audioEnabled = audioEnabled && !ended` — на завершении джема движок гасится сразу
  (`engine.destroy()`), а не только при уходе со страницы.
- **Джем-takeover глобального плеера**: пока звук джема активен, `store/player.ts`
  держит `jamOverride: { code, track, isPlaying }` (не персистится в `vire-player`).
  Мини-бар (`components/player/mini-bar.tsx`) в этом режиме рендерит трек джема с
  бейджем «Джем» и одной кнопкой play/pause — сик, лайк, шаффл, prev/next, волна и
  очередь скрыты. Play/pause зовёт модульный регистр `lib/jam/jam-controls.ts`
  (`setJamToggle`/`jamToggle`), который `jam-room.tsx` привязывает к
  `handleTogglePlayback`. `lib/player/audio-engine.ts` гардит `playQueue`/`togglePlay`/
  `next`/`prev`/`resumeRestored`/`playAt` — пока `jamOverride` не null, глобальный
  движок не запускает звук (два источника звука одновременно недопустимы).
- Права: транспорт (play/pause/seek/track) и «Перемешать» — любой участник (та же
  идентичность user XOR guest, что у мутаций очереди, проверяется как участие в
  сессии); удаление чужого трека, кик, закрытие джема — только HOST. Автопереход по
  `ended` инициирует хост (анти-гонка).
- Управление в UI — у всех участников: клик по строке очереди — `POST playback
  {kind:'track'}` на этот трек (или play/pause, если это уже активный трек); бар
  «сейчас играет» над очередью (обложка/название/статус) с кнопкой play/pause
  (`positionMs` — `derivePositionMs(playback, serverNow())`). Кнопка «Перемешать»
  рядом с «Добавить трек» шлёт `POST queue {kind:'shuffle'}` — сервер тасует очередь
  Fisher-Yates (`applyQueueMutation`, `random` инъектируется, детерминируем в тестах),
  поднимает `queue_version`, бродкастит как обычную мутацию.
- Поиск трека для добавления (`GET /api/v1/search`) матчит по названию трека ИЛИ
  имени артиста ИЛИ названию релиза; при пустом запросе панель показывает до 8
  любимых треков вошедшего юзера («Из любимых», проп `suggestions` от `[code]/page.tsx`).
- Лимиты: очередь ≤200, участники ≤50, добавления 10/мин (Redis-счётчик);
  авто-закрытие после 12ч без активности — воркер `jam-reaper` (каждые 15 мин,
  порог интервалом в SQL).
- «Сохранить в плейлист» — залогиненный участник сохраняет очередь себе
  (`PlaylistService.create` + `addTrack`); при сохранении хостом пишется
  `jam_sessions.saved_playlist_id`.
- Приглашение друзей — уведомление `JAM_INVITE` в колокольчик (+realtime), ссылка
  ведёт на `/jam/id/{jamId}` → серверный редирект на комнату по коду.
- Join бродкастит `jam:participants` со свежим списком сразу после входа (и kick —
  после удаления) — участники видят друг друга без ручного refresh
  (`use-jam-room.ts` уже подписан на это событие).

## Где код

- **Страницы:** `app/(listener)/jam/page.tsx` (вход: создать/войти по коду),
  `jam/[code]/` (комната: `jam-room`, `jam-join`, `jam-add-panel`, `jam-participants`,
  `jam-save-playlist`), `jam/id/[jamId]` (редирект из уведомления)
- **API:** `app/api/v1/jam/route.ts` (создание), `jam/time`,
  `jam/[code]/{join,queue,playback,heartbeat,end,stream,qr,save-playlist,invite}`
  (`queue` и `playback` резолвят идентичность через `resolveJamIdentity` — user или
  подписанный guest `sessionId`, не только `auth()`), `GET /api/v1/friends`
- **Сервисы/логика:** `packages/core/src/services/{jam,jam-sync,jam-queue,jam-code}.ts`
  (чистые: права участия, лимиты, `applyQueueMutation` вкл. `shuffle`,
  `derivePositionMs`, `decideDriftCorrection`, `pickClockOffset`), порт
  `ports/jam-state.ts`; `apps/web/lib/jam/*` (`server-clock`, `jam-audio`,
  `use-jam-room`, `use-jam-queue`, `use-playback-sync`, `jam-state`, `jam-identity`,
  `jam-controls`, `guest-name`); `lib/realtime.ts` —
  `publishChannel`/`subscribeChannel`, канал `rt:jam:{id}`; `components/jam-share.tsx`,
  `components/jam-invite.tsx`; takeover глобального плеера — `store/player.ts`
  (`jamOverride`), `components/player/mini-bar.tsx`, `lib/player/audio-engine.ts`
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
- Конкурентный drag во время `shuffle` — LWW, позиция может разъехаться (тот же класс,
  что конкурентные `move`).
