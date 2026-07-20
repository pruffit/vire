# План: качество джема и чата

Спека: `docs/superpowers/specs/2026-07-21-jam-chat-quality.md`. Ветка: main (после
v1.29.0). Два независимых потока.

## Поток J — джем

### J1. Поиск (packages/db/src/queries/search.ts)
Трек-ветка `searchAll`: `and(eq(tracks.status,'READY'), or(ilike(tracks.title,q),
ilike(artistProfiles.name,q), ilike(releases.title,q)))`. Джойны уже есть.

### J2. Плейбек хоста (apps/web/app/(listener)/jam/[code]/jam-room.tsx)
- `onPlay`: для хоста — POST `{kind:'track', trackId}` (helper `postPlayback`);
  не-хост — без play-аффорданса (SortableTrackRow: посмотреть пропсы, возможно
  `onPlay` опционален или отдать noop без иконки play).
- Бар «сейчас играет» над очередью или в шапке: обложка+название активного трека
  (искать в очереди по `room.playback.trackId`), для хоста кнопка play/pause:
  pause → `{kind:'pause', positionMs: derivePositionMs(room.playback, serverNow())}`,
  resume → `{kind:'play', trackId, positionMs: derivePositionMs(...)}`
  (`derivePositionMs` из `@vire/core`, уже импортируется в use-playback-sync).
- Ошибки POST — toast.

### J3. Подсказки (jam-add-panel.tsx + [code]/page.tsx)
- `[code]/page.tsx` (server): для залогиненного — любимые треки (`getLikedTracksCached`
  из `@/lib/listener-data`, взять ~8, смапить в SearchTrack-шейп) → проп через JamRoom
  в JamAddPanel (`suggestions: SearchTrack[]`).
- Панель: при `q.trim().length < 2` показывать suggestions с заголовком «Из любимых»
  (вместо «Начните вводить…»; если suggestions пусты — старый текст).

### J4. Шапка и лейаут комнаты (jam-room.tsx, jam-share.tsx, jam-save-playlist.tsx)
- Пилюли с текстом: убрать `touchTargetClass`, дать `min-h-11 px-4 rounded-full ...`;
  JamInvite (иконка-only) оставить 44×44.
- Шапка: слева статус/название/код, справа группа действий, переносы без наездов
  (flex-wrap, gap); на мобилке действия рядом под заголовком.
- Контент (`add-panel` + очередь + now-playing): обернуть в `max-w-4xl mx-auto w-full`.
- Обновить `jam-room.test.tsx` (плейбек хоста: клик по треку шлёт POST; пилюли).
- Прогнать `docs/features/jam*.md` — отразить управление хоста (найти файл).

## Поток M — сообщения + сайдбар

### M1. Двухпанельный /messages
- Новый `apps/web/app/(listener)/messages/layout.tsx` (server): auth-гейт, диалоги
  через `chatService().listConversations`, корень `data-app-screen` + `flex h-full
  min-h-0`; левая колонка `w-80 xl:w-96 border-r` со своим `overflow-y-auto`
  (DeviceLink + ConversationList), правая — `{children}` (flex-1 min-w-0).
- Видимость на мобилке: клиент-обёртка с usePathname (`/messages` ⇒ список on,
  правая скрыта; глубже ⇒ наоборот; на md+ обе видны).
- `messages/page.tsx` → заглушка «Выберите диалог» (центр, иконка) — видна только md+.
- `messages/[conversationId]/page.tsx`: убрать свой `data-app-screen` (он теперь на
  layout), из данных страницы убрать дубли (список уже в layout); тред остаётся.
- ConversationList: подсветка активного диалога (usePathname), ссылки как были.
- Убедиться: `[&:has([data-app-screen])]`-механика в (listener)/layout продолжает
  работать (маркер теперь на layout сообщений — тот же DOM-предок).

### M2. Состояния треда (chat-thread.tsx)
- Вместо нижней строки notReady — центрированное состояние в области треда:
  иконка (lock/message-square), заголовок, 1–2 строки объяснения, действие:
  needsLink → кнопка-ссылка «Привязать устройство» (на /messages список — на
  мобилке; на десктопе DeviceLink уже слева) — сформулировать по месту;
  нет ключа собеседника → «{Имя} ещё не открывал(а) Vire — переписка станет
  доступна, как только зайдёт» (имя пропом уже есть otherName? если нет — передать).
- Пустой тред при готовом ck — как сейчас, но проверить центрирование в новой сетке.
- Композер: при блоке скрыт, при готовности — прижат к низу.

### M3. Сайдбар (library-sidebar.tsx)
- `LibraryRow.subtitle` — опционален; «Друзья» без заявок — без подписи (title
  вертикально по центру). Проверить остальные подписи на дубли.
- Свёрнутый рейл: единый размер/форма плиток (иконки — rounded-md плитки как сейчас,
  аватары артистов — круг 40 — ок), выровнять паддинги, ничего не обрезано.

## Гейты (в конце): turbo typecheck, lint, check:routes, полные тесты, audit:design,
build. Самокритика отдельным сабагентом. Версия → 1.30.0, тег, деплой.
