# План: редизайн релиза и трека

Спек: `docs/superpowers/specs/2026-07-01-release-track-redesign-design.md`.
Делегируется Sonnet-сабагентам. Опус — оркестрация + самокритика-арбитраж.

## Wave 1 — общий кит (блокирует Wave 2)
1. `components/section-header.tsx` ← вынос из артиста (`page.tsx` ~632), артист → импорт.
2. `components/lyrics-scroll.tsx` ← вынос из `components/player/lyrics.tsx`; пропсы
   `variant 'player'|'artist'`, `trackId` (гард синхрона), `onSeekTo`. Плеер → импорт
   `variant='player'`, вид неизменен.
3. `components/ambient-backdrop.tsx` — + верхний accent-радиал (22%), opacity 0.32→0.4.
Гейт: typecheck + lint зелёные.

## Wave 2 — страницы (после Wave 1)
**Релиз** `…/releases/[releaseId]/page.tsx` + `track-list.tsx`:
- `max-w-6xl` сохранить; `opacity-*`/`white-x` → `color-mix(...text NN%)`.
- «Треки» и «Liner notes» → `<SectionHeader>`.
- Заголовок — fluid-кламп (как у артиста).
- `TrackRow`: `min-h-11`, hover/active фон через color-mix.

**Трек** `…/tracks/[trackId]/page.tsx`:
- Токенизировать поверхности волны и «Из релиза» (`bg-black/15`/`ring-white/[0.06]`
  → color-mix), `opacity-*` → mix, заголовок-кламп.
- НОВОЕ: секция «Текст» (Волна → Текст → «Из релиза»), только если `track.lyrics?.length`;
  серверный рендер `track.lyrics`; клиент `track-lyrics.tsx` → `LyricsScroll
  variant='artist' trackId` + `onSeekTo`=play-or-seek.
Гейт: все (typecheck/lint/check:routes/test/audit:design/build) + layout-shell зелёный.

## Wave 3 — критика + ship
- Независимый Sonnet прожаривает по VireMusic-чеклисту.
- Доки: `docs/features/lyrics.md` (+инлайн на треке), §2.7 stage-2.
- Версия в 2 местах при необходимости; коммит.
