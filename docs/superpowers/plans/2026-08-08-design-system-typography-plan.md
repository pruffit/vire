# План: дизайн-система и типографика (§2.2 + §2.4)

Спека: `docs/superpowers/specs/2026-08-08-design-system-typography-design.md`.
Три среза, каждый — свой прогон гейтов и свой коммит.

## Срез A — фундамент

**A1. Роли в `packages/ui/src/globals.css`.** После блока `@theme inline`:

```css
@utility label-mono {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
@utility readout {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums slashed-zero;
}
```

В `@layer base` — `h1, h2, h3 { text-wrap: balance; }` (требование
`ui-principles.md:161-168`, в CSS сейчас отсутствует).

Цвет и вес в роли не задавать. `label-mono` не задаёт `line-height` — наследуется от места.

**Проверка до раскатки:** `pnpm --filter @vire/web build`, затем убедиться, что классы
`label-mono`/`readout` попали в выходной CSS (`.next/static/css/*.css`). Если Tailwind не
подхватил `@utility` из импортируемого пакета — перенести оба блока в
`apps/web/app/globals.css` рядом с существующими `@utility animate-*`, `@layer base`-правило
оставить в `packages/ui`. Дизайн-решение при этом не меняется.

**A2. Чистка публичного API `packages/ui`.**
- `packages/ui/src/index.ts:1` — убрать `buttonVariants` из экспорта (0 импортов; cva
  остаётся внутри `components/button.tsx`).
- `packages/ui/src/index.ts:7` — убрать строку экспорта Card; удалить
  `packages/ui/src/components/card.tsx`.
- `apps/web/app/(listener)/design/page.tsx:32` — убрать Card из импорта; удалить секцию
  демо Card (строки ~368–393) и упоминание Card в подзаголовке (строка ~301).

**A3. Киты на роли.** `apps/web/components/ui-kit.tsx` — заменить повторяющийся
`font-mono text-[11px] uppercase tracking-[0.08em]` на `label-mono` в `Field`,
`SectionLabel`, `Th`, `ActionLink` и остальных вхождениях; числовые ячейки (`Td` с пропом
`nums`/`mono`, счётчик в `PageHeader`, `StatCard`) — на `readout`.
`apps/web/components/content-kit.tsx` — то же для `Eyebrow`, `StatusPill`.
Цветовые классы при этом не трогать — они остаются на месте применения.

**A4. Гейт.** Новый `apps/web/app/__tests__/design-tokens.test.ts` по образцу
`app/__tests__/layout-shell.test.ts`:
- рекурсивный обход `app/` и `components/` по `*.tsx`;
- правило 1: запрет `text-white`/`bg-white`/`border-white`/`white/NN`/`black/NN` и hex в
  классах вне allowlist;
- правило 2: запрет одновременного `font-mono` + `uppercase` + `tracking-[` в одной строке
  className (сырой eyebrow вместо `label-mono`);
- allowlist — константа-массив в файле теста, по одной строке обоснования на файл.

Первоначальный allowlist собрать из реальных оверлеев поверх медиа: `party-screen.tsx`
(`bg-[#09090c]`, белый по видео), `video-player.tsx`, `zoomable-cover.tsx`,
`components/visualizer/*`, `cover-rail.tsx`. Остальное из топ-15 карты — кандидаты на
чистку в срезах B и C, до тех пор тоже в allowlist, но помечены как временные.

**A5.** Фичедок `docs/features/design-system.md` (роли и когда какую; границы `packages/ui`
против `ui-kit.tsx`; правила гейта и как завести исключение).

## Срез B — слушательская оболочка

Раскатка ролей и выборочная чистка литералов по публичным экранам; из allowlist вычёркивается
всё, что почищено.

`readout` на длительностях и счётчиках — конкретные места из карты, где `formatDuration`
идёт без `tabular-nums`:

- `app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/page.tsx:294`
- `app/(listener)/artists/[slug]/releases/[releaseId]/track-list.tsx:172`
- `app/(listener)/artists/[slug]/releases/[releaseId]/page.tsx:185-186`
- `components/release-quick-look.tsx:275`
- `components/playlist-quick-look.tsx:150`
- `app/(listener)/playlists/[id]/page.tsx:134,138`
- `app/(listener)/artists/[slug]/follow-button.tsx:69` (счётчик в `motion.span` —
  только `tabular-nums`, без mono: число анимируется в прозе)
- `components/featured-release.tsx:22-23` (строка `meta` — только `tabular-nums`)

Эталон, на который равняться: `components/player/mini-bar.tsx`, `components/player/fullscreen.tsx`,
`components/sortable-track-row.tsx`, `components/track-list.tsx` — там пара уже стоит верно.

Чистка литералов по топу карты: `genre-picker.tsx` (24), `release-quick-look.tsx` (17),
`featured-release.tsx` (16), `lyrics-editor.tsx` (10), `editorial-playlist-card.tsx` (7),
`artist-card.tsx` (5), `smartlink/[artistSlug]/[linkSlug]/page.tsx` (5), `track-row.tsx` (4),
`release-countdown.tsx` (4). В каждом — решение по месту: базовый текст/фон → токен,
оверлей поверх обложки → остаётся, файл остаётся в allowlist с обоснованием.

## Срез C — дашборд и админка

То же в `/dashboard/*` и `/admin/*`. После среза A большая часть разметки уже получает роли
через `ui-kit.tsx`, поэтому объём меньше: остаются инлайн-вхождения в
`admin/tracks/[id]/edit/track-edit-form.tsx`, `admin/analytics/page.tsx`,
`admin/system/system-panel.tsx`, `dashboard/releases/[id]/track-manager.tsx`,
`components/lyrics-editor.tsx`, `download-button.tsx`.

## Гейты (каждый срез)

```bash
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```

Срезы B и C трогают UI-разметку → после них визуальная проверка ключевых экранов
(главная, артист, релиз, трек, дашборд, админка) в узком вьюпорте и на десктопе.

## Чего не делать

Не вводить типографическую шкалу и второй набор токенов; не трогать спейсинг,
`PageContainer`, макеты, app-shell, `color-mix(--artist-*)`; не переводить
`btnPrimary`/`btnGhost` на `Button`.
