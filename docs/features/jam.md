# Джем-сессии

Совместная комната для тусовок: несколько человек (включая гостей без аккаунта)
подключаются по коду/ссылке/QR к общей очереди треков и слышат одно и то же
в одну секунду. Спека: `docs/superpowers/specs/2026-07-20-jam-sessions-design.md`.

## Глобальная сессия (app-shell)

Джем — не состояние страницы `/jam/[code]`, а сессия уровня приложения: уход со страницы
(клик «Главная» и т.п.) не обрывает джем. Три слоя (спека
`docs/superpowers/specs/2026-08-01-jam-global-session-design.md`):

- `store/jam.ts` (zustand, persist `vire-jam`) — «какой джем активен» (`code`,
  `participantId`, `role`, `sessionId`); переживает F5. `audioEnabled` не персистится —
  после перезагрузки звук блокирует браузер, включается первым жестом.
- `components/jam/jam-session-provider.tsx` — смонтирован в корневом `app/layout.tsx`
  вокруг `#main-content` + `PlayerWrapper`, а не на странице. Владеет SSE-комнатой
  (`useJamRoom`), серверными часами, `usePlaybackSync`, транспортом (`setJamTransport`)
  и `jamOverride`. `jamOverride` выставляется при активном джеме **независимо** от
  `audioEnabled` (иначе после F5 нет ни бара, ни пути назад в комнату) — с полем
  `needsAudioGesture` (`store/player.ts`): мини-бар сначала включает звук локальным
  жестом, и только если джем на паузе — шлёт toggle. `jam:ended` чистит стор + тост.
  Хук `useJamSession()` отдаёт контекст странице.
- `app/(listener)/jam/[code]/jam-room.tsx` — вью поверх сессии: очередь (DnD), панели
  добавления/участников, join-экран. Определяет активную сессию как
  `session.code === code`; если сессия чужая/отсутствует — экран `JamJoin`.
- Мини-бар (`components/player/mini-bar.tsx`) в режиме джема — бейдж «Джем»/«Пульт»
  теперь ссылка на `/jam/{code}` (вернуться в комнату), рядом — явная кнопка выхода
  (`useJamStore().leave()`), видна и на `<sm` (единственный способ освободить плеер
  на мобильном).

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
  **Тайм-стретч (`playbackRate`) не используется вовсе** — только seek или ничего:
  дрейф >2с (`HARD_SEEK_MS`) — жёсткий seek на ожидаемую позицию, иначе `none`. Раньше
  умеренный дрейф (200мс–2с) гнался `playbackRate = 1 ± 0.01`, но позиция считалась ДО
  того, как HLS реально начинал звучать (манифест + первый сегмент грузятся 1–3с) —
  клиент стабильно отставал на время буферизации и rate-коррекция работала минутами,
  слышно как «каша». Вместо этого позиция ресинкается по факту начала звука: на
  загрузке трека и на возобновлении с паузы делается грубый seek ДО `play()` (не
  грузить трек с нуля), а точный — только после первого события `playing` у `<audio>`
  (`engine.onPlaying`, `use-playback-sync.ts`), когда буферизация первого сегмента уже
  прошла и `serverNow()` отражает реальный момент старта звука. Подписка на `playing`
  одноразовая (снимает себя после первого срабатывания) и отменяется при смене
  трека/паузе/размонтировании — staleness-guard как у `load`. Периодическая коррекция
  (интервал `SYNC_INTERVAL_MS` 10с) задемпфирована (`DriftDamperState`): пока элемент
  буферизует (`waiting` без `playing`) и `SEEK_COOLDOWN_MS` (10с) после жёсткого seek
  решение — `none`, иначе столл кормит сам себя (столл → seek → новый столл → заикание).
  **Коррекция дрейфа включена только когда в комнате 2+ звуковых устройства** — в одиночном
  джеме синхронизировать не с кем, и коррекция (даже редкий seek) — чистый минус. Устройства
  считаются по факту открытого SSE-соединения (`jam:{id}:presence` ZSET в Redis,
  `IJamStateStore.listPresent`/`dropPresence`), а не по списку когда-либо заходивших
  участников: вход в стрим шлёт heartbeat и сразу бродкастит `jam:presence
  {participantIds}` всем; разрыв соединения (`stream/route.ts` `cleanup()`, срабатывает
  и на `cancel()`, и на `abort`) зовёт `JamService.leave` — снимает присутствие и
  бродкастит свежий список (деградирует молча при недоступном Redis). `jam-room.tsx`
  считает `audioDeviceCount` (в SPEAKER всегда 1, в SYNCED — `presentParticipantIds.length`)
  и включает `driftCorrection` только при `mode === 'SYNCED' && audioDeviceCount > 1`.
  Отдельный аудио-движок `lib/jam/jam-audio.ts` — на общем HLS-слое `lib/player/hls-runtime.ts`
  (`HLS_TUNING` + `attachStallRecovery`, те же настройки, что у основного плеера);
  громкость берёт из `usePlayerStore` при создании и подписывается на изменения
  (ползунок в мини-баре управляет и джемом). Вход в звук — явный тап (автоплей-политика);
  `usePlaybackSync` получает `audioEnabled = audioEnabled && !ended` — на завершении
  джема движок гасится сразу (`engine.destroy()`), а не только при уходе со страницы.
- **Джем-takeover глобального плеера**: пока звук джема активен, `store/player.ts`
  держит `jamOverride: { code, track, isPlaying, durationSec, canPrev, canNext }` (не
  персистится в `vire-player`). Мини-бар (`components/player/mini-bar.tsx`) в этом
  режиме — полноценный транспорт: обложка, название с бейджем «Джем», артист,
  prev/play-pause/next (prev/next `disabled` по `canPrev/canNext`), общая с обычным
  баром `ProgressLine` (`components/player/progress-line.tsx`) с перемоткой, тайминги
  на `sm+`; лайк/волна/очередь по-прежнему скрыты. Позицию тикает
  `lib/jam/use-jam-position.ts` (интервал 250мс, `getJamTransport()?.positionMs()`,
  останавливается вне `ticking`/паузы — контракт как у `useAudioTime`). Транспорт —
  модульный регистр `lib/jam/jam-controls.ts` (`setJamTransport`/`getJamTransport`,
  `jamToggle()` для play/pause), который `jam-room.tsx` заполняет в эффекте
  (`toggle`/`next`/`prev`/`seek`/`positionMs`); внутрикомнатного бара «сейчас играет»
  больше нет — комната делит транспорт с глобальным мини-баром. `lib/player/audio-engine.ts`
  гардит `playQueue`/`togglePlay`/`next`/`prev`/`resumeRestored`/`playAt` — пока
  `jamOverride` не null, глобальный движок не запускает звук (два источника звука
  одновременно недопустимы).
- Права: транспорт (play/pause/seek/track) и «Перемешать» — любой участник (та же
  идентичность user XOR guest, что у мутаций очереди, проверяется как участие в
  сессии); удаление чужого трека, кик, закрытие джема — только HOST. Автопереход по
  `ended` инициирует хост (анти-гонка).
- Управление в UI — у всех участников: клик по строке очереди — `POST playback
  {kind:'track'}` на этот трек (или play/pause, если это уже активный трек); подсветка
  активной строки — по индексу первого совпадения `trackId` в очереди (не по всем
  совпадениям — иначе дубли трека подсвечивались бы разом). Кнопка «Перемешать»
  рядом с «Добавить трек» шлёт `POST queue {kind:'shuffle'}` — сервер тасует очередь
  Fisher-Yates (`applyQueueMutation`, `random` инъектируется, детерминируем в тестах),
  поднимает `queue_version`, бродкастит как обычную мутацию. Реордер — только
  drag-хендл (`SortableTrackRow`, без шевронов вверх/вниз — убраны везде в проекте).
- Панель добавления трека (`jam-add-panel.tsx`) знает свою очередь: уже добавленный
  трек показывает галочку и подпись «Добавлено» вместо «+», кнопка `disabled`
  (`addedTrackIds`, считается из `jamQueue.queue`); `handleAdd` в комнате тоже
  игнорирует повтор — двойной тап не шлёт второй `add`. На `<lg` панель открывается
  в `components/sheet.tsx` (свайп/Esc/тап по подложке); на `lg+` — инлайн в сайдбаре.
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
- **Режимы (`jam_sessions.mode`): SYNCED (дефолт) / SPEAKER.** SYNCED — звук у всех
  участников (описано выше). SPEAKER — звук только на одном устройстве
  (`speaker_participant_id`, `null` = хост), остальные — пульт: очередь и транспорт
  работают как обычно, но `audioEnabled` в `usePlaybackSync` гасится, движок не создаётся
  вовсе. Чистые функции `resolveSpeakerParticipantId`/`isAudioDevice`
  (`packages/core/src/services/jam-mode.ts`) резолвят звуковое устройство: назначенный
  участник, если ещё в комнате, иначе фолбэк на HOST. На звуковом устройстве в SPEAKER
  периодическая коррекция дрейфа выключается целиком (`usePlaybackSync`, проп
  `driftCorrection`) — синхронизировать не с кем, источник один. Режим меняет только
  HOST (`POST /api/v1/jam/[code]/mode`); роль колонки любой участник забирает себе
  (`POST /api/v1/jam/[code]/speaker`) — обе мутации бродкастят `jam:session
  { mode, speakerParticipantId }`. Автопереход по `ended`: в SYNCED — хост (как раньше),
  в SPEAKER — колонка (у пультов события `ended` нет вовсе, движок не создаётся). Мини-бар
  такeover помечает пульт бейджем «Пульт» вместо «Джем» (`JamOverride.isRemote`), транспорт
  и полоса прогресса остаются рабочими. Экран создания (`/jam`) даёт выбрать режим до
  создания джема.

## Где код

- **Глобальная сессия:** `apps/web/store/jam.ts` (какой джем активен, persist),
  `apps/web/components/jam/jam-session-provider.tsx` (SSE/движок/транспорт/оверлей,
  смонтирован в `app/layout.tsx`, хук `useJamSession`)
- **Страницы:** `app/(listener)/jam/page.tsx` (вход: создать/войти по коду, выбор
  режима в `create-jam-button.tsx`), `jam/[code]/` (вид комнаты поверх сессии:
  `jam-room`, `jam-join`, `jam-add-panel`, `jam-participants`, `jam-save-playlist`),
  `jam/id/[jamId]` (редирект из уведомления)
- **API:** `app/api/v1/jam/route.ts` (создание, принимает `mode`), `jam/time`,
  `jam/[code]/{join,queue,playback,mode,speaker,heartbeat,end,stream,qr,save-playlist,invite}`
  (`queue`/`playback`/`mode`/`speaker` резолвят идентичность через `resolveJamIdentity` —
  user или подписанный guest `sessionId`, не только `auth()`), `GET /api/v1/friends`
- **Сервисы/логика:** `packages/core/src/services/{jam,jam-sync,jam-queue,jam-code,jam-mode}.ts`
  (чистые: права участия, лимиты, `applyQueueMutation` вкл. `shuffle`,
  `derivePositionMs`, `decideDriftCorrection`, `pickClockOffset`,
  `resolveSpeakerParticipantId`/`isAudioDevice`; `JamService.listPresent`/`leave` —
  presence поверх `IJamStateStore.listPresent`/`dropPresence`), порт
  `ports/jam-state.ts`; `apps/web/lib/jam/*` (`server-clock`, `jam-audio`,
  `use-jam-room`, `use-jam-queue`, `use-playback-sync` (проп `driftCorrection`),
  `jam-state`, `jam-identity`, `jam-mode-labels`,
  `jam-controls` — регистр транспорта `JamTransport`, `use-jam-position` — тик позиции
  для мини-бара, `guest-name`, `optimistic-playback` — кнопка play/pause отвечает мгновенно:
  визуал и команда считаются от оптимистичного `effectivePaused`, звук по-прежнему от
  серверного `room.playback`. Pending снимается по **росту `version`** серверного playback
  (любая долетевшая мутация, своя или чужая), либо по TTL 5с, либо по ошибке запроса);
  `lib/realtime.ts` —
  `publishChannel`/`subscribeChannel`, канал `rt:jam:{id}`; `components/jam-share.tsx`,
  `components/jam-invite.tsx`; takeover глобального плеера — `store/player.ts`
  (`jamOverride`, вкл. `isRemote`), `components/player/{mini-bar,progress-line}.tsx`,
  `lib/player/audio-engine.ts`
- **Воркер:** `apps/worker/src/workers/jam-reaper.worker.ts` +
  `lib/jam-cleanup.ts` (Redis-ключи и `jam:ended` — те же, что у web)
- **Данные:** `packages/db/src/schema/jam.ts` — `jam_sessions` (вкл. `mode`,
  `speaker_participant_id` — миграция 0045) / `jam_participants`
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
