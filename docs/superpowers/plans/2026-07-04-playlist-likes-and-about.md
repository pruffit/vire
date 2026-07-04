# Лайки плейлистов + актуализация «О платформе» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Довести лайки плейлистов до полноценной фичи (кнопка на странице плейлиста + секция лайкнутых в медиатеке — бэкенд уже готов) и актуализировать тексты страницы «О платформе» (хоткей R, лайки плейлистов).

**Architecture:** Бэкенд полностью существует: таблица `playlist_likes`, счётчик `playlists.likes_count`, запросы `likePlaylist`/`unlikePlaylist`/`getPlaylistLikeState`, роут `/api/v1/playlists/[id]/like` (GET/POST/DELETE, rate-limit), лайк на карточках главной (`editorial-playlist-card.tsx`). Достраиваем UI: общий хук оптимистичного лайка (дедуп логики карточки), кнопка в шапке `/playlists/[id]`, новый db-запрос `getLikedPlaylists` + секция в `/library` с переиспользованием `EditorialPlaylistCard`.

**Tech Stack:** Next.js 15 App Router, Drizzle (`packages/db`), Vitest, motion/react, Tailwind.

## Global Constraints

- Слои строго: Route Handler → core/db, страница (RSC) читает db-запросы напрямую по паттерну соседних страниц; хендлер не знает про БД-детали сверх вызова запроса.
- НИКАКОГО `min-h-screen`/`h-screen` на страницах/лейаутах (app-shell).
- Перед новым UI — переиспользовать готовое (`EditorialPlaylistCard`, `Section`, `HeartIcon`, `EmptyState`); не плодить дубли — общее выносить.
- Optimistic UI по умолчанию (паттерн из `editorial-playlist-card.tsx`: мгновенный флип + откат в catch).
- Минимум комментариев — только неочевидное «почему».
- Мобильная вёрстка обязана быть проверена (шапка плейлиста на узком вьюпорте, грид медиатеки).
- TypeScript strict, без `any`.
- Тесты — Vitest, паттерн route-тестов соседей (`apps/web/app/api/v1/playlists/[id]/tracks/route.test.ts` как образец моков).
- Гейты после изменений: `pnpm --filter @vire/web typecheck && lint && check:routes && test && audit:design && build`.

---

### Task 1: Общий хук лайка + кнопка на странице плейлиста + тест роута

**Files:**
- Create: `apps/web/components/use-playlist-like.ts`
- Modify: `apps/web/components/editorial-playlist-card.tsx` (перевести на хук, поведение 1-в-1)
- Create: `apps/web/app/(listener)/playlists/[id]/playlist-like-button.tsx`
- Modify: `packages/db/src/queries/playlists.ts` (в `PlaylistWithTracks` добавить `likesCount: number`; в `getPlaylistWithTracks` вернуть `playlist.likesCount`)
- Modify: `apps/web/app/(listener)/playlists/[id]/page.tsx`
- Test: `apps/web/app/api/v1/playlists/[id]/like/route.test.ts` (новый — роут существует, теста нет)

**Interfaces:**
- Produces: `usePlaylistLike(playlistId: string, initialLiked: boolean, initialCount: number): { liked: boolean; likes: number; pending: boolean; toggle: () => Promise<void> }` — оптимистичный флип + инкремент/декремент счётчика, откат обоих в catch, guard по pending. Тело — перенос `toggleLike` из `editorial-playlist-card.tsx` без изменения поведения (fetch POST/DELETE на `/api/v1/playlists/${playlistId}/like`).
- Produces: `<PlaylistLikeButton playlistId initialLiked initialCount />` — client component: `HeartIcon filled={liked}` + счётчик, `motion.button whileTap={{ scale: 0.85 }} transition={spring.snappy}`, `aria-label` «В избранное»/«Убрать из избранного», красный залитый как на карточке (`[color:oklch(65%_0.20_25)]`). Стиль — пилюля рядом с метаданными шапки (`rounded-full border border-border px-3 py-1.5 text-sm`, hover как соседние кнопки).

- [ ] **Step 1: Хук.** Вынести логику лайка из `editorial-playlist-card.tsx` в `use-playlist-like.ts` (`'use client'`-модуль не нужен — хук импортируется только клиентами; но директива не повредит и защищает от RSC-импорта — поставить `'use client'`). Карточку перевести на хук; JSX карточки не менять.
- [ ] **Step 2: db.** `PlaylistWithTracks.likesCount` + маппинг в `getPlaylistWithTracks`.
- [ ] **Step 3: Кнопка и страница.** В `page.tsx`: `const liked = session?.user?.id && !isOwner ? await getPlaylistLikeState(session.user.id, id) : false;` (импорт из `@vire/db`). В шапке (блок с заголовком, после строки счёта треков): залогиненному не-владельцу — `<PlaylistLikeButton>`; владельцу и анониму кнопку не рендерить, аноним видит счётчик текстом в строке метаданных, если `likesCount > 0` (` · N ♥` не надо — просто «N лайков» через существующий формат строки `{tracks.length} … · {duration}` дополнить ` · {likesCount}` с иконкой сердца inline, размер 13, `text-muted-foreground`). Владелец видит тот же статический счётчик.
- [ ] **Step 4: Тест роута.** По образцу соседей: 401 без сессии (GET/POST/DELETE), POST → `likePlaylist` вызван + `{ liked: true }`, DELETE → `unlikePlaylist` + `{ liked: false }`, GET → `{ liked }` из `getPlaylistLikeState`. Моки `@/auth`, `@vire/db`, `@/lib/rate-limit` — скопировать подход из `tracks/route.test.ts`.
- [ ] **Step 5: Прогнать** `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test` (полный прогон), затем lint.
- [ ] **Step 6: Commit** `feat(playlists): кнопка лайка на странице плейлиста + общий хук usePlaylistLike`.

### Task 2: Лайкнутые подборки в медиатеке

**Files:**
- Modify: `packages/db/src/queries/playlists.ts` (новый `getLikedPlaylists`)
- Modify: `apps/web/lib/listener-data.ts`
- Modify: `apps/web/app/(listener)/library/page.tsx`

**Interfaces:**
- Consumes: `hydratePlaylists(rows: PlaylistMetaRow[])`, `META` (оба уже в `playlists.ts`), `EditorialPlaylistCard` (`components/editorial-playlist-card.tsx`, пропсы `{ playlist: EditorialPlaylist; liked: boolean }`).
- Produces: `getLikedPlaylists(userId: string): Promise<EditorialPlaylist[]>` — `select(META).from(playlistLikes).innerJoin(playlists, eq(playlists.id, playlistLikes.playlistId))` где `eq(playlistLikes.userId, userId)` и `eq(playlists.visibility, 'PUBLIC')` (ставший приватным лайкнутый плейлист скрывается), `orderBy(desc(playlistLikes.createdAt))`, затем `hydratePlaylists(rows)`. Экспортировать из пакета так же, как соседние запросы.

- [ ] **Step 1: Запрос** `getLikedPlaylists` в `playlists.ts` + экспорт.
- [ ] **Step 2: Кэш-обёртка** в `listener-data.ts`: `export const getLikedPlaylistsCached = cache(getLikedPlaylists);`.
- [ ] **Step 3: Секция в медиатеке.** В `library/page.tsx` добавить `getLikedPlaylistsCached(session.user.id)` в `Promise.all`. После секции «Плейлисты» — при `likedPlaylists.length > 0` секция `<Section title="Лайкнутые подборки" count={...}>` с тем же гридом (`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4`, `Stagger`/`StaggerItem`), карточки — `<EditorialPlaylistCard playlist={p} liked />`. При 0 лайкнутых секцию не рендерить вовсе (без EmptyState — необязательный контент).
- [ ] **Step 4: Прогнать** typecheck + test + lint.
- [ ] **Step 5: Commit** `feat(library): секция лайкнутых подборок в медиатеке`.

### Task 3: «О платформе» + доки

**Files:**
- Modify: `apps/web/app/(listener)/about/about-content.tsx`
- Modify: `docs/features/playlists.md`

**Требования:**
- В `FOR_LISTENERS` карточка «Плеер и поток»: перечисление хоткеев дополнить R — «…горячие клавиши (пробел, стрелки, M, R — повтор)». Карточка «Плейлисты»: дополнить про лайки чужих подборок — например «Свои подборки в один клик… Чужие публичные подборки можно лайкать — они соберутся в медиатеке.» (формулировка редактируется по месту, тон страницы сохранить).
- Таблица хоткеев уже содержит R («Режим повтора») — сверить полный список с `use-player-hotkeys.ts` и `command-palette.tsx`, при расхождении дополнить.
- `docs/features/playlists.md`: секция про лайки плейлистов — таблица `playlist_likes` + денормализованный `playlists.likes_count`, роут `/api/v1/playlists/[id]/like` (GET/POST/DELETE, rate-limit 60/мин), точки UI (карточка на главной, шапка страницы плейлиста, секция в медиатеке), правило видимости (PRIVATE-плейлисты выпадают из лайкнутых).

- [ ] **Step 1:** правки `about-content.tsx` и `playlists.md`.
- [ ] **Step 2:** typecheck + lint (контент-правка, но tsx).
- [ ] **Step 3: Commit** `docs(about): хоткей R и лайки плейлистов на странице о платформе + доки`.

---

## Ship (в главной сессии после ревью)

- Финальное ревью ветки, гейты полностью (вкл. `audit:design`, `build`).
- Версия 1.9.0 → 1.10.0 в корневом `package.json` И `apps/web/package.json`, `pnpm install` (lockfile), коммит.
- Тег/деплой — ТОЛЬКО по явной команде пользователя.
