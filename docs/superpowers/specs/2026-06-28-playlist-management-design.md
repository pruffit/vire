# Дизайн: комплексная механика работы с плейлистами

Дата: 2026-06-28
Статус: на ревью
Ветка: feat/listener-dashboard-shell (или новая feat/playlist-management)

## Проблема

Текущая страница плейлиста `/playlists/[id]` — минимальный server-component:
обложка = первый трек, заголовок, переименование/удаление, список треков. Управлять
плейлистом неудобно:

- Треки добавляются **только** с страницы трека (кнопка «+»). На самой странице
  плейлиста добавить нечего — пустой стейт буквально говорит «добавляй через + на
  странице трека».
- **Нет переупорядочивания** — `position` есть в схеме, но менять её нечем (ни API,
  ни UI).
- Удаление трека делает `window.location.reload()` — грубо, теряет позицию скролла.
- В UI нет управления **приватностью** (PRIVATE/PUBLIC), **описанием**, **обложкой**
  (хотя схема частично готова).
- На странице нет кнопок «Слушать всё» / «Перемешать».
- Возможны **дубли** треков: нет уникального ограничения и проверки при добавлении.

## Цель

Сделать страницу плейлиста полноценным рабочим местом владельца: добавление треков
поиском прямо на странице, drag-n-drop порядок, инлайн-редактирование метаданных
(название, описание, приватность, своя обложка), быстрые действия воспроизведения —
всё оптимистично, без перезагрузок, с поддержкой мобилки и доступности.

Layout остаётся **компактным центрированным** (`max-w-3xl`), обогащается экшен-баром.

## Решения по объёму (подтверждено)

Включаем всё: drag-n-drop, инлайн-поиск+добавление, тумблер приватности, описание,
своя обложка, умные подсказки треков. Панель добавления — **инлайн под шапкой**.

Вне объёма (YAGNI сейчас): коллаборативные плейлисты (`is_collaborative` остаётся как
есть), переупорядочивание чужими, шеринг-карточки.

## Архитектура

Слои VireMusic соблюдаются: Route Handler (HTTP) → query в `packages/db` → Postgres.
Бизнес-правила плейлистов тривиальны (владение, позиции) и живут в запросах
`packages/db/src/queries/playlists.ts` — отдельный сервис в `packages/core` не заводим
(следуем текущему паттерну этого модуля).

Фронт: страница из чистого server-component превращается в **server-shell + один
клиентский оркестратор** `PlaylistView`, который держит оптимистичный стейт (порядок и
состав треков, метаданные) и раздаёт колбэки дочерним островам. FSD: всё под
`app/(listener)/playlists/[id]/`.

### Схема БД (миграция 0015)

1. `playlists.cover_url text` — кастомная обложка (null → фолбэк на первый трек, как
   сейчас). Все геттеры (`PlaylistSummary`, `EditorialPlaylist`, `getPlaylistWithTracks`)
   отдают `coverUrl = playlists.cover_url ?? первый трек`.
2. `playlist_tracks` — `unique('playlist_tracks_playlist_track_unique').on(playlistId, trackId)`.
   Защита от дублей. Перед добавлением индекса миграция дедуплицирует существующие
   строки (на F&F-проде дублей, скорее всего, нет; де-дуп идемпотентен и безопасен).
   `addTrackToPlaylist` получает `onConflictDoNothing`.

### Слой запросов (`packages/db/src/queries/playlists.ts`)

- `reorderPlaylistTracks(playlistId, userId, orderedTrackIds)` — транзакция: проверяет
  владение, что множество `orderedTrackIds` == текущему составу, переписывает `position`
  по индексу массива, бампает `updatedAt`. Возвращает `Result`-подобный boolean
  (false при чужом плейлисте / рассинхроне состава).
- `updatePlaylist(playlistId, userId, { title?, description?, visibility? })` — заменяет
  узкий `renamePlaylist` (тот остаётся как тонкая обёртка или удаляется, если не нужен).
- `setPlaylistCover(playlistId, userId, coverUrl | null)`.
- `getPlaylistSuggestions(playlistId, userId, limit)` — кандидаты для добавления,
  исключая уже добавленные: лайкнутые треки юзера + недавно слушанные + «похожие на
  плейлист» (треки тех же артистов/настроений, что уже в плейлисте). Переиспользует
  существующие источники (likes, play_events, moods); каждый блок — отдельная секция в
  ответе с пометкой источника.
- `searchTracksForPlaylist(q, excludeTrackIds, limit)` — поиск READY-треков по названию
  (как в `searchAll`, но с исключением уже добавленных и бóльшим лимитом). Чистая
  выборка, без дублирования логики `searchAll` сверх необходимого.

`getPlaylistWithTracks` дополняется `description`, `coverUrl`, `isCollaborative` (для
будущего) и кастомной обложкой.

### Route Handlers

Все мутации — только владелец (проверка `ownerUserId === session.user.id`), вход через
zod.

| Метод | Путь | Назначение |
|---|---|---|
| `PUT` | `/api/v1/playlists/[id]/tracks` | reorder: `{ trackIds: string[] }` (полный порядок) |
| `PATCH` | `/api/v1/playlists/[id]` | расширяется: `title?`, `description?` (≤500), `visibility?` (`PRIVATE`/`PUBLIC`) |
| `POST` | `/api/v1/playlists/[id]/cover` | multipart: `cover` (File) или `removeCover=1` → S3 `playlists/{id}.{ext}` через `uploadToStream` + `validateImageUpload` |
| `GET` | `/api/v1/playlists/[id]/suggestions` | умные подсказки (владелец) |
| `GET` | `/api/v1/playlists/[id]/add-search?q=` | поиск треков для добавления (исключая уже добавленные) |

Существующие `POST /tracks` (добавление, теперь dedup) и `DELETE /tracks/[trackId]`
остаются. Динамические сегменты называем как соседи (`[trackId]`).

Обложка: добавляем `PLAYLIST_COVER_POLICY` в `lib/image.ts` (или переиспользуем
`AVATAR_POLICY`, если ограничения совпадают). Ключ S3 стабильный `playlists/{id}.{ext}`,
URL c `?v=timestamp` для сброса кэша — как у аватаров.

### Компоненты (фронт)

Под `app/(listener)/playlists/[id]/`:

- **`page.tsx`** (server) — грузит плейлист + `isOwner`, рендерит `PlaylistView`.
  Не-владельцу отдаёт тот же `PlaylistView` с `isOwner=false` (read-only: без dnd,
  add-панели и меню; только воспроизведение).
- **`playlist-view.tsx`** (client, оркестратор) — стейт `tracks` (порядок+состав),
  метаданные; `DndContext` (dnd-kit) c `SortableContext`; колбэки add/remove/reorder;
  собирает очередь для плеера; держит экшен-бар и инлайн-панель.
- **`playlist-track-row.tsx`** — рефактор в `useSortable`-строку: ручка-грабёр
  (`⠿`, видна на hover/таче), play-оверлей (как сейчас), удаление **оптимистичное**
  (без reload). Drag только у владельца.
- **`playlist-add-panel.tsx`** — раскрывается по «+ Добавить треки»: поле поиска
  (debounce, `/add-search`) + секции подсказок (`/suggestions`); каждая строка —
  `[+]`/`[✓]` toggle, оптимистично добавляет в конец и в стейт `PlaylistView`.
- **`playlist-settings-menu.tsx`** — overflow-меню владельца: переименовать, описание,
  приватность (тумблер), загрузить/убрать обложку, удалить. Переиспользует паттерны
  `AddToPlaylistButton` (поповер, клик-вне) и `PlaylistActions` (инлайн-правка).
  Старый `PlaylistActions` поглощается этим меню.

Экшен-бар (компактный, центрированный layout): `[▶ Слушать] [⤮ Перемешать]
[+ Добавить треки] [⋯ меню]`. На мобилке бар переносится (`flex-wrap`), панель и строки
— на всю ширину контейнера.

### DnD

Библиотека `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (нет в зависимостях —
добавляем в `apps/web`). Причина выбора: headless, доступность из коробки (клавиатура),
тач-сенсор для мобилки, маленький бандл, активно поддерживается. Вертикальный список,
`restrictToVerticalAxis`, `PointerSensor` + `KeyboardSensor` + `TouchSensor` с задержкой
активации (чтобы тап-плей не конфликтовал с драгом). `onDragEnd` → оптимистичный
reorder локально, затем `PUT`; при ошибке — откат к прежнему порядку + toast.

## Поток данных

```
page.tsx (server)
  getPlaylistWithTracks(id) → { tracks, meta, isOwner }
     ↓ props
PlaylistView (client, useState: tracks, meta)
  ├─ ActionBar → controls.play(queue) / shuffle / toggle add-panel / settings-menu
  ├─ AddPanel → /add-search, /suggestions → POST /tracks → tracks.push (optimistic)
  ├─ DndContext → SortableContext → TrackRow[]
  │     onDragEnd → arrayMove(tracks) → PUT /tracks {trackIds} (optimistic, откат при fail)
  │     onRemove → tracks.filter → DELETE /tracks/[id] (optimistic, откат при fail)
  └─ SettingsMenu → PATCH (title/desc/visibility) / POST cover / DELETE playlist
```

## Обработка ошибок

- Все мутации оптимистичны: локальный стейт меняется сразу, при `!res.ok` — откат +
  `toast.error`. Паттерн уже устоялся в `AddToPlaylistButton`.
- Reorder: сохраняем снапшот прежнего порядка до запроса, откат при ошибке.
- Загрузка обложки: ошибки валидации с сервера (`validateImageUpload`) показываем
  тостом; превью через blob (`<img>`, не next/image — как в формах профиля).
- Приватный плейлист остаётся скрыт от чужих (текущая логика `notFound`/403 сохраняется).

## Тестирование

- **Query** (`packages/db`): reorder (переписывает позиции, отвергает чужого и
  рассинхрон состава), dedup при add, `updatePlaylist` (visibility/description).
- **Route handlers** (`app/api/.../route.test.ts`): права+валидация для PUT /tracks
  (reorder), расширенного PATCH (visibility/description), POST /cover (владелец, размер/
  тип), GET /suggestions и /add-search (только владелец). Следуем существующим тестам
  роутов плейлистов.
- **App-shell инвариант** не нарушаем: `main` без `min-h-screen`, скролл — область
  шелла.
- Гейты: typecheck, lint, check:routes, test, audit:design (трогаем UI), build.

## Документация

Обновить/создать `docs/features/playlists.md` (или секцию в `interactions.md`):
что умеет, где код, новые роуты, env (S3 для обложек), ограничения (нет
коллаборативности). Бамп версии в двух местах + lockfile (добавляем dnd-kit).

## Открытые риски

- Уникальный индекс на существующих данных: миграция дедуплицирует перед созданием
  индекса; если на проде окажутся дубли — де-дуп оставит минимальную `position`.
- dnd-kit + тач: тонкая настройка activation constraint, чтобы тап по строке играл
  трек, а удержание — тащило. Покрываем ручным verify на узком вьюпорте.
