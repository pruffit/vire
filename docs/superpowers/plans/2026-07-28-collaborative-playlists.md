# План: коллаборативные плейлисты

Дизайн — `docs/superpowers/specs/2026-07-28-collaborative-playlists-design.md`.
Два среза, последовательно: A (данные/core/API), B (UI/realtime-клиент).

## Срез A — схема, запросы, core, роуты

### A1. Схема + миграция
- `packages/db/src/schema/interactions.ts`: в `playlists` добавить
  `collabToken: text('collab_token')`, `version: integer('version').notNull().default(0)`;
  новая таблица `playlistCollaborators` (см. спеку — поля, unique, два индекса).
- `packages/db/src/schema/notifications.ts`: в `notificationTypeEnum` добавить
  `'PLAYLIST_COLLAB_JOIN'`.
- `pnpm --filter @vire/db db:generate` → миграция 0044, применить `db:migrate`.

### A2. Запросы (`packages/db/src/queries/playlists.ts`)
- `listPlaylistCollaborators(playlistId)` → `{ userId, name, image, joinedAt }[]`.
- `isPlaylistCollaborator(playlistId, userId)` → boolean.
- `addPlaylistCollaborator(playlistId, userId, invitedBy)` → `onConflictDoNothing`.
- `removePlaylistCollaborator(playlistId, userId)`.
- `countPlaylistCollaborators(playlistId)`.
- `setPlaylistCollaboration(playlistId, ownerId, { isCollaborative, collabToken })` —
  выключение обнуляет токен.
- `getPlaylistCollabState(playlistId)` → `{ isCollaborative, collabToken, version, ownerUserId }`.
- `getPlaylistTrackAddedBy(playlistId, trackId)` → `userId | null` (гард удаления).
- `bumpPlaylistVersion` — **не отдельной функцией**: инкремент `version` вписывается в
  существующие транзакции `addTrackToPlaylist` / `removeTrackFromPlaylist` /
  `reorderPlaylistTracks`. Считать в SQL (`version + 1`), не читать-писать из JS.
- `getPlaylistWithTracks`: в трек-строки добавить `addedBy: { id, name, image } | null`
  (левый join на `users` по `playlist_tracks.added_by`), в шапку — `isCollaborative`,
  `version`.
- `getUserPlaylists`: объединить свои и те, где юзер в `playlist_collaborators`
  (`union` или `or` через left join), в `PlaylistSummary` — `role: 'OWNER' | 'COLLABORATOR'`.

### A3. Core
- `packages/core/src/types/playlist.ts`: `PlaylistTrack.addedBy`, `PlaylistWithTracks.isCollaborative`
  + `version`, `PlaylistSummary.role`, новый `PlaylistCollaborator`.
- `packages/core/src/ports/playlist-realtime.ts` — зеркало `jam-realtime.ts`:
  `broadcast(playlistId, event)`.
- `packages/core/src/repositories/playlist.ts` — методы под A2 в `IPlaylistRepository`.
- `packages/core/src/services/playlist.ts`:
  - приватный `canEdit(playlist, userId)` → владелец или коллаборатор; `addTrack`,
    `reorder` переходят на него вместо голого `ownerUserId !== userId`;
  - `removeTrack`: владелец — любой, коллаборатор — только если `addedBy === userId`,
    иначе `ForbiddenError`;
  - `getForViewer`: доступ также коллаборатору и по валидному токену (новый
    необязательный аргумент `joinToken`);
  - `setCollaboration(id, ownerId, enabled)` — генерит токен через инъектированный
    `IdGenerator` (порт уже есть в `ports/effects.ts`), выключение обнуляет;
  - `rotateCollabToken(id, ownerId)`;
  - `join(id, userId, token)` — все гарды из спеки, включая `isBlockedEitherWay`
    (порт блокировок уже есть — переиспользовать, не дублировать запрос) и лимит 50;
  - `leave(id, userId)`, `kick(id, ownerId, targetUserId)`;
  - `listCollaborators(id, viewerId)` — только участникам;
  - после каждой мутации состава — `broadcast` соответствующего события; ошибки
    брокера не должны валить мутацию.
- Уведомление владельцу при `join` — через существующий `NotificationService`/порт,
  тип `PLAYLIST_COLLAB_JOIN`, `entityId = playlistId`.

### A4. Роуты (`apps/web/app/api/v1/playlists/[id]/`)
- `tracks/route.ts` — добавить `GET` → `{ tracks, version }`, доступ по правилам просмотра.
- `collaborators/route.ts` — `GET` список (участникам), `POST { token }` присоединиться,
  `DELETE` выйти самому.
- `collaborators/[userId]/route.ts` — `DELETE` кик (владелец).
- `collaboration/route.ts` — `PATCH { enabled }` тумблер, `POST` сброс токена (владелец);
  ответ включает готовую ссылку-приглашение.
- `stream/route.ts` — SSE, копия структуры `jam/[code]/stream/route.ts` (snapshot,
  heartbeat 25с, cleanup по abort), доступ только участникам совместного плейлиста.
- Существующие `tracks` POST/PUT и `tracks/[trackId]` DELETE — без изменений в HTTP-части,
  права уже решает сервис.
- Тесты рядом с каждым роутом по образцу соседних `route.test.ts`: права (владелец /
  коллаборатор / чужой / аноним), гарды присоединения, 404 приватного без токена.

### A5. Гейты среза A
`pnpm --filter @vire/db typecheck` · `@vire/core typecheck` · `@vire/core test` ·
`@vire/web typecheck` · `@vire/web test`.

## Срез B — UI

### B1. Страница `/playlists/[id]`
- `page.tsx`: читать `?join=<token>` (`searchParams`), пропускать по валидному токену;
  вычислять роль зрителя (`OWNER | COLLABORATOR | VIEWER`) и отдавать её вниз;
  `generateMetadata` и `opengraph-image.tsx` **не** пускать по токену (приватный остаётся
  noindex и нейтральной картинкой).
- Шапка: бейдж «Совместный» + стек аватаров участников (переиспользовать существующий
  примитив аватара, не писать новый).
- `playlist-settings-menu.tsx`: секция совместности для владельца (тумблер, копия ссылки,
  сброс, список участников с «Исключить»); для коллаборатора — «Покинуть плейлист».
- Баннер приглашения при `?join=` — кто зовёт, кнопка «Присоединиться»; аноним → вход
  с `callbackUrl` на ту же ссылку.
- `playlist-track-row.tsx`: аватар добавившего — **только** в совместном плейлисте.
- `playlist-view.tsx`: права на действия по роли (коллаборатор не видит «удалить» на
  чужих строках), подписка на SSE только для участника совместного плейлиста, события
  своего `actorId` игнорируются, на чужие — перечитывание `GET tracks` и замена состава
  по `version` (устаревшие версии отбрасывать).

### B2. Медиатека
- `/library`: секция плейлистов показывает и коллаборативные с пометкой роли.

### B3. Гейты среза B
Все из verify-контракта, включая `audit:design` (UI трогаем) и `build`.

## Документация (после B)
- `docs/features/playlists.md` — раздел «Коллаборативные плейлисты» (модель, права,
  realtime, ограничения); снять из «на будущее».
- `docs/roadmap/stage-2.md` §7.3 → ✅, `docs/roadmap/TODO.md` — если есть связанный пункт.
- `CLAUDE.md` — номер последней миграции.

## Чего не делать
Голосование, комментарии, история изменений, гостевой доступ без аккаунта, уведомления
на каждое добавление трека, права «только предлагать».
