# План: обложки-коллажи + шеринг плейлистов

Спека: `../specs/2026-07-14-playlist-covers-and-sharing-design.md`

## Волна A — данные (`packages/db`) · параллельно с B

1. Выделить `fetchPlaylistMeta(ids): Map<id, { trackCount, covers }>` из
   `hydratePlaylists` (`packages/db/src/queries/playlists.ts:337`) — два batch-запроса,
   без изменения поведения редакционных подборок.
2. `hydratePlaylists` перевести на него (выдача не меняется).
3. `getUserPlaylists` (:72) — убрать N+1 (`Promise.all` с двумя запросами на плейлист),
   перевести на `fetchPlaylistMeta`; `PlaylistSummary` получает `covers: string[]`.
4. Чистая `pickCovers(playlistCoverUrl, trackCovers)` — дедуп, своя обложка первой, ≤4.
   Место: рядом с типами плейлистов, экспорт из `@vire/db`.
5. Тесты: `pickCovers` (дедуп/приоритет/порог), `getUserPlaylists` отдаёт covers.

## Волна B — поповер-примитив (`apps/web/components`) · параллельно с A

1. `components/popover.tsx` — общий шелл: outside-click, Escape, AnimatePresence,
   позиционирование с авто-флипом, тач-таргет ≥44px, `drop="down"` как у
   `track-queue-menu` (клип overflow-hidden в peek-шите).
2. Перевести на него `track-share.tsx` и `track-queue-menu.tsx` — поведение
   сохранить один-в-один (это рефактор, не редизайн).
3. Тесты компонента: открытие/закрытие по Escape и клику вне, флип.

## Волна C — UI, шеринг, OG (после A и B)

1. `components/playlist-cover.tsx` — `variant="mosaic" | "single"`, порог мозаики ≥4,
   общий плейсхолдер (вынести иконку из `CoverFan`).
2. Раскатка: шапка `app/(listener)/playlists/[id]/page.tsx`,
   `components/listener/playlist-card.tsx`, `components/listener/library-sidebar.tsx` (single).
3. `PlaylistShare` — на примитиве из B: PUBLIC → копия ссылки / `navigator.share` на таче;
   PRIVATE + владелец → «Сделать публичным и поделиться» (PATCH visibility, затем копия).
4. `app/(listener)/playlists/[id]/opengraph-image.tsx` — `ImageResponse` 1200×630,
   коллаж + название/автор/треки; **PRIVATE → нейтральный фон без данных**.
5. `generateMetadata`: PUBLIC → canonical + OG/Twitter; PRIVATE → `robots: noindex`.
6. Тесты: OG приватного не отдаёт название; шеринг-кнопка не видна не-владельцу приватного.
7. Доки: `docs/features/playlists.md` (обложки, шеринг, OG), `TODO.md` (закрыть техдолг
   поповера), `stage-2.md` §7.3.

## Инварианты (чеклист Vire)

- Мобилка: тач-таргеты ≥44px, шеринг через `navigator.share`, шапка не ломается на узком.
- app-shell: никаких `min-h-screen`/`h-screen`; коллаж не промоутит композит-слой
  (без 3D/blur/will-change — как в `buildFan`).
- Не плодить дубли: обложка плейлиста рендерится ТОЛЬКО через `PlaylistCover`.
- Комментарии — только неочевидное «почему».
