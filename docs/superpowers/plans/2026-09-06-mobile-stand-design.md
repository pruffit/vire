# План: дизайн стенда на Android

Спека — `docs/superpowers/specs/2026-09-06-mobile-stand-design.md`.

## Шаг 0 — готово (главная сессия)

- `packages/design-tokens/src/marks.ts` + экспорт `@vire/design-tokens/marks` — знак «Потока»
  переехал из `apps/web/lib` в пакет, который видят все клиенты. Веб перенаправлен.
- `components/vireglass/glass-surface.tsx` — проп `progress?: SharedValue<number>`; значение
  идёт в канал линзы через слот `u_progress` в `lensAnimatedProps` и в униформы поверхности.
- `components/ui/glass-panel.tsx` — пробрасывает `progress`, принимает `press`/`active`
  (по умолчанию прежние постоянные нули).

## Шаг 1 — кнопка «ПОТОК» (новый файл)

`apps/mobile/components/player/flow-button.tsx`

- `GlassPanel` во всю ширину поля, `height 52`, `radius 18`,
  `material={FLOW_MATERIAL}` — модульная константа `= VIREGLASS_CONTROL_MATERIAL`
  (новый объект на рендер пересобрал бы всю оптику).
- Содержимое — дети панели, по центру строкой: знак 21 (`react-native-svg`, `FLOW_MARK`,
  viewBox 24, обводка 2, круглые концы) + «ПОТОК» `fonts.display` 19, `letterSpacing 0.4`.
  Цвет обоих — `useInkColor()` из `lib/vireglass/glass-ink`: полярность ведёт панель.
- `Pressable` поверх, `press` гонится `withSpring(1/0, PRESS_SPRING)` теми же параметрами,
  что в `components/liquid-glass.tsx`; на нажатии — `Haptics.impactAsync(Medium)`.
- Проп `onPress`, `accessibilityRole="button"`, `accessibilityLabel="Включить поток"`.

## Шаг 2 — экран трека

`apps/mobile/screens/player-screen.tsx`

Раскладка первого экрана — колонка высотой во вьюпорт: распорка `flex:1`, затем обложка,
подпись, прогресс, транспорт, «ПОТОК». Отбивки и кегли — таблица в спеке, дословно.
Порядок сверху вниз тот же, что в стенде.

- Обложка: `min(width - 2*layout.screenPadding, доступная высота)`, радиус 18. Существующий
  `CoverCarousel` остаётся (свайпы, двойной тап, лонгпресс) — меняются только размер и радиус.
- Подпись: название `type.releaseTitle` (22, витринное начертание), артист `type.subtitle`;
  обе строки выключены влево по полю экрана. Ссылка на артиста сохраняется.
- Справа от подписи, по её середине: `heart` (существующий `LikeButton`) и `share` 21,
  шаг 34, `opacity 0.62`. Кнопка «поделиться» открывает уже готовый `ShareSheet`.
- Прогресс: `ProgressLine` перекрасить в стендовые цвета (трек `#39404f`, залив `#e6eaf2`,
  высота 4) и поднять таймкоды под полосу — позиция слева, длительность справа, кегль 11.
- Транспорт: `Transport` привести к размерам/плотностям стенда (19/0.5 · 26/0.85 · 34/1 ·
  26/0.85 · 19/0.5, шаг = ширина поля / 4.6). Рамок и подложек у кнопок нет.
- Верхняя панель: `chevron-down` слева; `text` (текст песни) и `more-horizontal` справа,
  22, шаг 36, `opacity 0.72`; метка источника по центру. Тумблер текста уезжает СЮДА из
  угла обложки — слот `lyricsToggleSlot` и его стили удалить.
- `WaveBanner` из секции контекста и его импорт удалить: его работу делает «ПОТОК».
  `startWave` остаётся — его теперь зовёт кнопка.
- Контекст (`ArtistCard`, `SimilarArtists`, `QueueSection`) остаётся под сгибом.

Тач-зоны: любой значок меньше 48 добирается `hitSlop`, а не увеличением значка.

## Шаг 3 — фурнитура главной

- `components/mini-player.tsx`: высота из `lib/layout.ts` (`MINI_PLAYER_HEIGHT` 64 → 48),
  радиус 16, поле 9, обложка 30/радиус 8, отбивка текста 12, плей 22 + `hitSlop` до 48.
  Материал — та же модульная константа управляющего стекла. Блок `progressTrack`/
  `progressFill` и их стили удалить: долю теперь показывает сам материал —
  `progress` = `useSharedValue`, обновляется эффектом от `positionSec`/`durationSec`.
- `navigation/main-tabs.tsx`: `LiquidGlassButton` на управляющем материале; скрим довести
  до стендового (`rgba(3,2,1,0)` → `0.55: 0.65` → `1: 0.9`).
- `components/liquid-glass.tsx`: принять проп материала (по умолчанию прежний дефолт),
  чтобы навигация могла попросить управляющее стекло.

## Правила

- Комментарии — только неочевидное «почему», 1–2 строки. Пересказ раскладки запрещён:
  числа и так в спеке.
- Никаких новых зависимостей. Всё есть: `react-native-svg`, `expo-haptics`, Reanimated.
- Импорты стекла — через `lib/vireglass/*` (реэкспорт ядра), не из `@vire/vireglass` напрямую.
- После каждого шага: `pnpm --filter @vire/mobile typecheck`.

## Гейты в конце

`pnpm --filter @vire/mobile typecheck` · `pnpm --filter @vire/mobile test` ·
`pnpm --filter @vire/web typecheck` · `pnpm --filter @vire/web test` ·
`pnpm turbo run check:layers` · `pnpm check:doc-paths`
