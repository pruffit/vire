# План: багфикс-пачка v1.30.x (джем, чат, лейауты, мобилка)

Спека: `docs/superpowers/specs/2026-07-21-jam-chat-fixes.md`.
Исполнители — сабагенты Sonnet. Задачи A и B трогают `jam-room.tsx` → строго
последовательно A→B. C и D независимы от A/B и друг от друга.

## Task A — джем: takeover плеера, права, participants (логика)

Файлы:
- `apps/web/store/player.ts` — поле `jamOverride` (не персистить в `vire-player`!
  partialize/merge: override и isPlaying-режим джема не сохраняются).
- `apps/web/lib/player/audio-engine.ts` — в режиме override `toggle/play` глобального
  движка не запускают звук (guard).
- `apps/web/components/player/mini-bar.tsx` — рендер джем-режима: обложка/название/
  «ДЖЕМ», play/pause → колбэк из override; скрыть очередь/волну/шаффл/лайк/сик.
- `apps/web/lib/jam/use-playback-sync.ts` — принимать `enabled = audioEnabled && !ended`;
  на дизейбл — `engine.destroy()`; экспортировать isPlaying текущего движка не надо —
  playback state уже есть в jam-room.
- `apps/web/app/(listener)/jam/[code]/jam-room.tsx` — эффект: ставить/чистить
  `jamOverride` (track = активный трек очереди, isPlaying = !playback.paused,
  toggle = handleTogglePlayback); при ended/unmount чистить. Кнопки транспорта
  (play/pause на баре, клик по строке) — для ВСЕХ участников, не только хоста.
  Кнопка «Перемешать» рядом с «Добавить трек» (мутация shuffle).
- `packages/core/src/services/jam.ts` — `setPlayback`: проверка «участник сессии»
  вместо «hostUserId». Сигнатура: принимать identity участника (как queue-мутации).
  `applyQueueMutation` (`jam-sync.ts`?) — новый kind `'shuffle'` (инъектируемый
  random/shuffle fn — эффект за интерфейсом). `join` — после успеха бродкаст
  `jam:participants` со свежим списком.
- `apps/web/app/api/v1/jam/[code]/playback/route.ts` — идентичность как в
  queue/route.ts (`resolveJamIdentity`), не только auth(); 403 только не-участникам.
- Тесты: `packages/core` — setPlayback для участника/не-участника/гостя, shuffle
  (детерминированный fake random), join бродкастит participants;
  `jam-room.test.tsx` — обновить под новые права; роут playback — гость с sessionId.

## Task B — джем: лейаут и мобильный UX (после A)

Файлы: `jam-room.tsx`, `jam-add-panel.tsx`, `jam-participants.tsx`.
- Убрать `mx-auto max-w-4xl`. lg+: `grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6` —
  слева now-playing + очередь, справа: панель добавления развёрнута постоянно
  (тоггл-кнопка скрыта на lg+), участники под ней.
- Мобилка: строки очереди min-h-14, drag только за handle (useSortable activator),
  handle ≥44×44px; шапка: кнопки иконками в один ряд, title не переносится под кнопки.
- Проверить `audit:design` на изменённых экранах.
- Тест лейаут-инварианта не ломать (никаких min-h-screen).

## Task C — чат: разделители, E2EE-плашка, typing, read, live-уведомления (параллельно A)

Файлы:
- `components/chat/conversation-list.tsx` — `divide-y divide-border/60` (или бордеры
  строк), активный: фон `bg-foreground/[0.08]` + `border-l-2 border-primary` (или
  эквивалент по токенам), непрочитанный — `font-medium` + точка как сейчас.
- `components/chat/chat-thread.tsx` — удалить `<details>` safety-number (и вычисление,
  если не используется); typing-индикатор в шапке треда («печатает…», таймаут 4с);
  подписка `chat:typing`, `chat:read`; статус «Прочитано/Отправлено» под последним
  своим сообщением по `otherLastReadAt`.
- `components/chat/message-composer.tsx` — на ввод throttled POST typing (~1 раз/2.5с,
  без запроса при пустом поле; fire-and-forget).
- Роуты: `app/api/v1/chat/[conversationId]/typing/route.ts` (POST, участник диалога →
  publish собеседнику), `app/api/v1/chat/unread-count/route.ts` (GET → число).
- `packages/core/src/services/chat.ts` — `send`: в событие добавить `senderName`
  (передавать из роута/сервиса); `markRead`: publish второй стороне `chat:read`
  (+`readAt`); `history`/`getConversationMeta` — вернуть `otherLastReadAt`.
- Live-бейджи: клиентский слушатель в shell (например, в `MessagesShell` нельзя — он
  только на /messages; сделать лёгкий `ChatEventsBridge` client-компонент в root
  layout рядом с `E2eeBootstrap`): событие `message` не для открытого диалога → toast
  «Сообщение от {senderName}»; бейджи в `mobile-tab-bar.tsx` и `library-sidebar.tsx` —
  локальный стейт с инициализацией из SSR-пропа + рефетч `/api/v1/chat/unread-count`
  по событию `message` (и по фокусу вкладки — дёшево).
- Тесты: роуты typing/unread-count (права: не участник → 403/404), сервис markRead
  publish, send payload senderName.
- Обновить `docs/features/chat.md` (плашка убрана, typing/read, live-бейджи).

## Task D — навигация, лейауты, PWA (параллельно A)

Файлы:
- `components/listener/mobile-tab-bar.tsx` — TABS → 4 (Главная, Поиск, Медиатека,
  Сообщения), `grid-cols-4`; бейдж заявок друзей → точка на «Медиатека»
  (`incomingCount > 0`).
- Мобильная страница `/library` — убедиться, что есть строки «Джем» и «Друзья»
  (library-sidebar виден только md+; на мобилке /library — страница со строками;
  если строк нет — добавить).
- `app/(listener)/library/liked/page.tsx` — full-bleed: убрать `max-w-3xl mx-auto`,
  паддинги `px-6 sm:px-10`, хедер как у релиза (иконка + мета слева). Тот же паттерн
  для `app/(listener)/playlists/[id]/page.tsx`, если там тот же узкий центр.
- `app/layout.tsx` — `appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: SITE_NAME }`
  в metadata.
- Тесты: снапшотов нет — прогнать существующие, `audit:design`.
- `docs/features/listener-shell.md` — актуализировать состав таб-бара.

## Task E — схлопнутый library-sidebar сломан (после C — тот же файл)

Скрин Дани 21.07: в collapsed-состоянии `components/listener/library-sidebar.tsx`
строки разъехались — иконки то с плиткой-подложкой, то голые, «Мой плейлист» обрезан,
«+» пропал, вертикальные отступы неровные. Привести collapsed-режим в порядок:
единый размер/подложка всех лидов (включая «Главная»/«Медиатека» сверху), центрирование
колонки, «+» доступен, тултипы/aria на иконках, ничего не клипается.

## Гейты (после каждой задачи, финально — все)

typecheck (web+core+db), lint, check:routes, test, audit:design, build.

## Ship
- Версия: 1.31.0 в корне и apps/web. lockfile при изменении package.json.
- Коммит(ы) по задачам, тег после зелёных гейтов — НЕ пушить без команды.
