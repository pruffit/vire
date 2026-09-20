# План: краевой эффект прокрутки на мобилке

Спека — `docs/superpowers/specs/2026-09-12-mobile-scroll-edge.md`. Ветка `feat/vireglass-mobile-scroll-edge`.

## 1. Канал — `apps/mobile/lib/scroll-edge.tsx` (новый)

- `ScrollEdgeProvider` — `strength: SharedValue<number>` (старт 1) + `inkLight: boolean`
  (старт `true`) в состоянии; `setInkLight` стабилен.
- `useScrollEdgeStrength()` → shared value, для скрима.
- `useScrollEdgeStyle()` → `ScrollEdgeStyle` из `scrollEdgeStyle(inkLight)` (`@vire/vireglass`).
- `useFurnitureInk(ink: number | undefined)` — пишет `ink > 0.5` в канал, вызывается из мебели.
- `useScrollEdgeProps()` → `{ onScroll, onContentSizeChange, onLayout, scrollEventThrottle: 32 }`
  для вертикального списка экрана: `onScroll` считает
  `scrollEdgeStrength('bottom', y, max)` и пишет в shared value; размеры держатся в ref'ах,
  `onLayout`/`onContentSizeChange` пересчитывают силу при известной прокрутке.
- `useResetScrollEdge()` — `useFocusEffect`, ставит силу 1 на входе экрана.

## 2. Скрим — `apps/mobile/components/furniture-scrim.tsx`

- `Animated.View` с `useAnimatedStyle(() => ({ opacity: strength.value }))`, внутри — нынешний
  `LinearGradient`.
- Цвета по стилю: `dim` — нынешние `SCRIM_COLORS`; `dissolve` — те же стопы на `colors.background`.
  Обе палитры — в `lib/layout.ts` рядом с существующей (`SCRIM_COLORS_DIM`, `SCRIM_COLORS_DISSOLVE`),
  чистая функция `scrimColors(style)` там же, под тест.

## 3. Мебель сообщает полярность — `apps/mobile/navigation/main-tabs.tsx`

Внутри `<GlassGroup>` — компонент без разметки, берёт `useGlassGroup()?.ink` и отдаёт
`useFurnitureInk`. Снаружи группы `ink` не виден, поэтому именно там.

## 4. Провайдер в корне — `apps/mobile/App.tsx`

`ScrollEdgeProvider` вокруг `RootNavigator`, внутри `BlurTargetProvider` (стенды не задевать).

## 5. Экраны

`useResetScrollEdge()` в `components/screen.tsx` и `screens/home-screen.tsx` (он `Screen` не
использует). Пропсы `useScrollEdgeProps()` — на ОСНОВНОЙ вертикальный список каждого экрана:

artist, chat-thread, conversations, friends, home, library, playlist, profile, release, search,
settings, user-profile.

Не трогать: горизонтальные карусели (`home-screen` внутри секций, `library-screen` вложенный),
`player-screen` (своя мебель, свой скролл), лаборатории `glass-lab`/`material-lab`,
`components/player/*`.

## 6. Тесты — `apps/mobile/lib/__tests__/scroll-edge.test.ts`

- `scrimColors('dim' | 'dissolve')` — разные палитры, длина совпадает со `SCRIM_STOPS`.
- сила: до замера 1; при `maxScroll = 0` — 0; в середине списка — 1; за `SCROLL_EDGE_ENGAGE_DP`
  до конца — доля. Проверяется чистая функция канала (`edgeStrengthFrom({scroll, content, layout})`),
  а не компонент: рендерера в мобильном стенде нет.

## 7. Доки

- `docs/features/mobile-app.md` — инкремент: что теперь делает скрим и чего он не делает (расфокус).
- `docs/vireglass/README.md` — снять строку «на мобилке краевой скрим остаётся статичным
  градиентом и к правилам ещё не подключён».

## Гейты

`@vire/mobile` test + typecheck, `@vire/vireglass` test + typecheck (ядро не трогаем, но правило
общее), `pnpm check:doc-paths`, `pnpm --filter @vire/web typecheck`.
