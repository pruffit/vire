# План — VireGlass Material v1 + Material Lab

Спека: `docs/superpowers/specs/2026-08-29-vireglass-material-v1.md`.
Порядок соответствует §29 брифа Phase 3: эффекты вводятся по одному, а не разом.

---

## Шаг 1 — ядро материала (главная сессия, Opus)

| Файл | Что |
|---|---|
| `apps/mobile/lib/vireglass/material.ts` | тип `VireGlassMaterial`, `resolveMaterial`, клэмпы, тумблеры `applyToggles`, пресеты, `VIREGLASS_MATERIAL_V1` |
| `apps/mobile/lib/vireglass/geometry.ts` | `VireGlassGeometry`, `circle/capsule/roundedRect`, `overscanFor` |
| `apps/mobile/lib/vireglass/sdf.ts` | общий SkSL-сниппет: `sdRect`, `edgeNormal`, `slope`, `smin` |
| `apps/mobile/lib/vireglass/surface-shader.ts` | SKSL-исходник поверхности, собранный поверх `sdf.ts` |
| `apps/mobile/lib/vireglass/lens-shader.ts` | AGSL-исходник линзы, собранный поверх того же `sdf.ts` |
| `apps/mobile/lib/vireglass/adapters.ts` | `toLensProps`, `toSurfaceUniforms`, `DEBUG_MODES` |

## Шаг 2 — нативный слой (главная сессия)

- `GlassLensView.kt`: проп `shaderSource` (компиляция с кэшем по строке, встроенный дефолт
  при отсутствии), униформы под новую модель, `u_debug`, вторая форма + `smin` для морфинга.
- `GlassLensModule.kt`: регистрация новых пропов.

## Шаг 3 — компоненты (главная сессия)

- `components/vireglass/glass-surface.tsx` — BlurView + GlassLens + Canvas на произвольном
  скруглённом прямоугольнике; пропы `geometry`, `material`, `debug`, `blurTarget`.
- `components/liquid-glass.tsx` — переводится на `GlassSurface`; публичный API кнопки
  (`size`, `icon`, `active`, `onPress`, `blurTarget`, `ink`, `tint`, `dim`) сохраняется.
- `lib/vireglass/environment.ts` — сенсор → нормализация → фильтр → направление света;
  по умолчанию выключен (`environment: 0`).

## Шаг 4 — стенд (сабагент, Sonnet)

- `screens/material-lab.tsx` — тумблеры, слайдеры, пресеты, debug-режимы, морфинг-сцена.
- `screens/material-lab-scene.tsx` — диагностический фон: контрастный текст, тонкие линии,
  градиенты, жёсткие грани, светлые/тёмные/цветные зоны, шахматка, движение.
- `App.tsx` — `EXPO_PUBLIC_GLASS_LAB=material`.
- `screens/glass-bench.tsx` — переключатель `baseline | v1` для сравнения по §21.

## Шаг 5 — тесты, прожарка, документация

- `lib/__tests__/vireglass-material.test.ts` (включая паритет пропов JS↔Kotlin).
- Прожарка дифа сабагентом (Sonnet) по чеклисту VireMusic.
- `docs/vireglass/material-lab.md` — журнал экспериментов (Эксперимент/Гипотеза/
  Реализация/Наблюдение/Решение), `README.md` и `architecture.md` — актуализация статусов.

## Гейты

`pnpm --filter @vire/mobile typecheck` · `pnpm --filter @vire/mobile test`.
Веб-гейты не трогаются: изменения целиком в `apps/mobile`.

## Риски

- **Регресс продовой кнопки.** Публичный API сохраняется, оптика переезжает на общий SDF.
  Проверяется typecheck + прожаркой; визуально — только на устройстве.
- **Компиляция AGSL из строки.** Ошибка валит линзу молча → падение в лог остаётся,
  встроенный дефолт в Kotlin страхует отсутствие/битый проп.
- **Замер.** adb в окружении нет: Material v1 утверждается по оптике, цифры — после прогона
  Danya на Xiaomi 2311DRK48G по прежнему протоколу.
