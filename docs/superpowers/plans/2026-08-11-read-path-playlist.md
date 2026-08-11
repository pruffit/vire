# План: read-path плейлиста (шаг 2.5)

**Спека:** `docs/superpowers/specs/2026-08-11-read-path-playlist.md` ·
**Эталон:** шаги 2.1/2.2 (`b79dbe7f`, `173b43b2`) — агрегат экрана + `.../page`-роут + `cache()`-обёртка.

---

## Срез A — сервис экрана (Sonnet)

**core** (`packages/core/src/music/curation/` — там, где живёт `PlaylistService`; если он в
другом подпакете, класть рядом с ним):

- `repositories/playlist-page.ts` — порт `IPlaylistPageRepository`:
  `likeState(userId: string, playlistId: string): Promise<boolean>`,
  `userName(userId: string): Promise<string | null>`.
- `types/playlist-page.ts` — `PlaylistPageView =
  { kind: 'invite'; title: string; ownerUserId: string | null }
  | { kind: 'playlist'; playlist: …; role: 'OWNER' | 'COLLABORATOR' | 'VIEWER';
      collaborators: PlaylistCollaborator[]; liked: boolean;
      invite: { title: string; ownerUserId: string | null } | null; inviterName: string | null }`.
  Тип плейлиста — тот, что уже возвращает `PlaylistService.getForViewer`.
- `services/playlist-page.ts` — `PlaylistPageService(playlistService, repo)`,
  `getPage({ playlistId, viewerId, joinToken })` → `Result<PlaylistPageView, NotFoundError | ForbiddenError>`.
  Логика — ровно та, что сейчас в `apps/web/app/[locale]/(listener)/playlists/[id]/page.tsx`
  (прочитать и перенести без изменений): checkInvite при токене; `getForViewer`; при отказе —
  `kind: 'invite'` только если токен валиден И зритель аноним, иначе ошибка; роль; коллабораторы
  (только владельцу/коллаборанту); `liked` только вошедшему не-владельцу; `inviterName` только
  когда баннер приглашения реально будет показан (коллаборативный + есть invite + роль VIEWER).
- Тест `playlist-page.test.ts` на фейках `PlaylistService`-порта и `IPlaylistPageRepository`:
  владелец, коллаборант, посторонний вошедший, аноним с валидным токеном, аноним без токена,
  приватный без доступа; проверить, что лишние порты не зовутся (нет `likeState` для владельца,
  нет `listCollaborators` для постороннего, нет `userName` без баннера).

**db:** `repositories/playlist-page.ts` — `DrizzlePlaylistPageRepository`: `getPlaylistLikeState`
и `getUserProfile` (имя) — тонкие обёртки. Экспорт из `packages/db/src/index.ts`.

**Гейты:** typecheck core/db, test core, `check:layers`.

---

## Срез B — два входа и контракт (Sonnet)

- `apps/web/lib/playlist-page.ts` — `getPlaylistPage = cache((id, viewerId, joinToken) => …)`
  поверх `playlistService()` (`apps/web/lib/playlist.ts`) и `DrizzlePlaylistPageRepository`.
- `apps/web/app/[locale]/(listener)/playlists/[id]/page.tsx` — `generateMetadata` и рендер
  берут агрегат отсюда; прямые `getPlaylistWithTracks`/`getPlaylistLikeState`/`getUserProfile`
  уходят. Разметка, JSON-LD, `robots` для приватного, ветка экрана приглашения — без изменений.
- `packages/api-contracts/src/playlist-page.ts` — `playlistPageResponseSchema`
  (размеченное объединение по `kind`, даты ISO).
- `apps/web/app/api/v1/playlists/[id]/page/route.ts` — `GET`: `joinToken` из query (`?join=`),
  viewer из сессии; 404/403 как в существующем `[id]/route.ts`. Соседние `route.ts`,
  `tracks/`, `collaborators/` не трогать.
- Тесты роута: владелец, коллаборант, посторонний, аноним с токеном (`kind: 'invite'`,
  без состава), аноним без токена на приватном (404); ответ парсится контрактом.

**Гейты:** typecheck/lint/test web, `check:routes`, `check:i18n`, build
(`NODE_OPTIONS=--dns-result-order=ipv4first` из `apps/web`, до 3 попыток — флакует next/font).

---

## После срезов

Отметки 2.5 ✅ в `docs/migration-plan.md`, `docs/roadmap/platform-core-brief.md`,
`docs/api-contracts.md`.
