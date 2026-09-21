# План: переезд монорепо на пакет `vireglass`

Решение и проверка подменой — `docs/vireglass/migration-to-package.md`. Здесь только
порядок работ и то, что уточнилось после публикации 2.2.0.

## Что подтвердилось на 2.2.0

Сверка экспортов настоящей установкой, а не по памяти:

| | |
|---|---|
| корень ядра | 129 значений |
| наш `src/index.ts` | 125 значений |
| только у нас | 13 = 12 сверочных полотен + `useGlassAdaptation` |
| только в ядре | 17 (`sdfRoundedRect`, `touchWarp`, `sceneGradient`, `smin`, …) |
| наш `src/web/index.ts` | `vireglass/web` (4) + локальный `drawReferenceScene` |

Ключи `MATERIAL_PRESETS` действительно переведены (`water glass crystal frosted thick
thin iridescent`), но в коде через них ходят только по `PRESET_NAMES` — литерал ровно
один: `apps/mobile/screens/material-lab.tsx:233`.

`useGlassAdaptation` — три вызова: `components/liquid-glass.tsx`,
`components/ui/glass-panel.tsx`, `screens/material-lab.tsx`. Все через
`lib/vireglass/adaptation.ts`.

## Конечное состояние среза

`packages/vireglass` остаётся, но становится **стендом**: сверочные полотна, их отрисовка
и гейты. Материал приезжает из реестра и проходит наружу через тот же вход `@vire/vireglass`,
поэтому потребители не переписываются.

Альтернатива — распустить шим и импортировать `vireglass` прямо из приложений — честнее
границей, но это ~25 точек импорта и отдельный заход; порядок в `migration-to-package.md`
её и откладывает («потом удаление копии»).

Исключение — `vireglass/react`: шим его НЕ реэкспортирует, иначе веб-стенд, где React нет,
начнёт его требовать. Мобилка берёт этот подпуть прямой зависимостью.

## Срезы

**1. Зависимость.** `vireglass: ^2.2.0` правкой `package.json` в `packages/vireglass`
и `apps/mobile` (для `vireglass/react`), затем `pnpm install` из корня — не
`pnpm add --filter` (предупреждение в `CLAUDE.md`: фильтрованный `add` при
`autoInstallPeers` плодит вторую копию типов RN).

**2. Подмена в пакете.**

```ts
// src/index.ts
export * from 'vireglass';
export * from './reference-scene';

// src/web/index.ts
export * from 'vireglass/web';
export * from './reference-draw';
```

Удаляются: `src/{material,optics,geometry,sdf,touch-response,lens-shader,surface-shader,
adaptation,accessibility,glass-scale,scroll-edge,concentric,group-model,adapters}.ts`,
`src/targets/`, `src/web/{renderer,probe,gl}.ts`.

Удаляются их тесты — они проверяют теперь чужой код, и он покрыт у себя:
`accessibility, adapters-density, concentric, glass-scale, raise-into-glass, scroll-edge,
shadow-adaptation, targets, touch-response, vireglass-adaptation, vireglass-group`.

Остаются: `reference-scene.test.ts`, `reference-draw.test.ts`, `measure-reference.test.ts`.

**3. Скрипты гейтов.** `check-optics.mjs` ходит через `../src/index.ts` и `../src/web/index.ts` — переживает подмену как есть. А вот глубокие импорты переписать:

- `check-glsl.mjs` — `../src/targets/glsl.ts`, `../src/lens-shader.ts`, `../src/surface-shader.ts` → `../src/index.ts`
- `measure-reference.mjs` — `../src/material` → `../src/index.ts`

**4. Потребители.**

- `apps/mobile/lib/vireglass/adaptation.ts` — добавить `export * from 'vireglass/react';`
- `apps/mobile/screens/material-lab.tsx:233` — `'Вода'` → `'water'`

**5. Гейты.** `typecheck` (vireglass, mobile, web), `test` (vireglass, mobile, web),
`check:glsl`, `check:optics`, `check:doc-paths`, `lint`, `build`.

`check:glsl` и `check:optics` остаются здесь намеренно: первый проверяет, что установленная
версия компилируется под нашу цель, второй меряет материал на НАШИХ полотнах.

**6. Документация.** `docs/vireglass/migration-to-package.md` — из плана в запись о
сделанном; `docs/features/vireglass-web.md` и `docs/vireglass/README.md` — пути на
`packages/vireglass/src/{web/renderer,…}` больше не существуют, их ловит `check:doc-paths`.

## Вне среза

RN-компоненты из `vireglass/native` (`VireGlassSurface`, `GlassGroup`, `GlassInkProvider`,
`GlassLens`, …) дублируют `apps/mobile/lib/vireglass/*.tsx` и `components/liquid-glass.tsx`.
Подмена там — риск визуальной регрессии, которую без устройства не увидеть. Отдельным заходом.
