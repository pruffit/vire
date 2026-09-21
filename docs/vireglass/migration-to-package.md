# Переезд на пакет `vireglass`

Сделано 21.09.2026. Своей копии ядра в монорепо больше нет: `packages/vireglass`
зависит от npm `vireglass@^2.2.0` и пропускает его наружу, оставляя себе только то,
что ядру не принадлежит, — сверочные полотна и гейты.

Ядро вынесено в open source 19.09.2026 (github.com/pruffit/vireglass, Apache-2.0).
Пока пакета не было в реестре, обе копии жили параллельно и расходились.

## Как выглядит после

```ts
// packages/vireglass/src/index.ts
export * from 'vireglass';
export * from './reference-scene';

// packages/vireglass/src/web/index.ts
export * from 'vireglass/web';
export * from './reference-draw';
```

Потребители (`apps/mobile/lib/vireglass/*`, `apps/web/rnd-src/*`) не переписывались:
вход остался тот же `@vire/vireglass`. Исключение одно — `vireglass/react`: шим его
НЕ реэкспортирует, иначе веб-стенд, где React нет, начнёт его требовать. Мобилка берёт
этот подпуть прямой зависимостью, через `apps/mobile/lib/vireglass/adaptation.ts`.

Удалено вместе с тестами: `material optics geometry sdf touch-response lens-shader
surface-shader adaptation accessibility glass-scale scroll-edge concentric group-model
adapters`, `src/targets/`, `src/web/{renderer,probe,gl}.ts`. Эти тесты проверяли бы
теперь чужой код, и он покрыт у себя.

Осталось здесь: `reference-scene.ts`, `web/reference-draw.ts`, их тесты и скрипты
`check-glsl.mjs`, `check-optics.mjs`, `measure-reference.mjs`. Гейты не переехали
намеренно: `check:glsl` проверяет, что УСТАНОВЛЕННАЯ версия компилируется под нашу цель,
`check:optics` меряет материал на НАШИХ полотнах.

## Что пришлось поправить

| | |
|---|---|
| `useGlassAdaptation` | переехал в `vireglass/react`; три вызова — через `lib/vireglass/adaptation.ts` |
| ключ пресета `'Вода'` | → `'water'`, один литерал (`apps/mobile/screens/material-lab.tsx`) |
| глубокие импорты в скриптах | `check-glsl.mjs` и `measure-reference.mjs` ходили в `../src/<модуль>` — теперь в `../src/index.ts` |

Сверка экспортов настоящей установкой перед подменой: корень ядра 129 значений, наша
копия 125; только у нас 13 = 12 сверочных полотен + `useGlassAdaptation`; только в ядре
17 (`sdfRoundedRect`, `touchWarp`, `sceneGradient`, `smin`, …). Наш `src/web/index.ts`
оказался ровно `vireglass/web` плюс локальный `drawReferenceScene`.

## Что не поехало

**Сверочные полотна.** Словарь видов слоя разошёлся при переводе ядра на английский
(`заливка полосы шахматка ступень черта сетка градиент` против `flat stripes checker step
bar grid gradient`), любой `switch (layer.kind)` сломался бы при подмене. Это не блокер,
а граница: все потребители полотен стендовые, продуктовых нет. В ядре 2.0.0 полотна
убраны с корня на подпуть `vireglass/reference` именно поэтому — чтобы хост со своими
полотнами мог взять материал, не обходя коллизию имён.

**RN-компоненты.** `vireglass/native` (`VireGlassSurface`, `GlassGroup`, `GlassInkProvider`,
`GlassLens`, …) дублирует `apps/mobile/lib/vireglass/*.tsx` и `components/liquid-glass.tsx`.
Подмена там — риск визуальной регрессии, которую без устройства не увидеть. Отдельным заходом.

Мало того, `vireglass` — ещё и Expo-модуль: в пакете лежит `android/` с тем же Kotlin-пакетом
`expo.modules.glasslens`, что и локальный `apps/mobile/modules/glass-lens`. Одна зависимость
уже задвоила автолинковку (22 модуля вместо 21) — пакет исключён через
`expo.autolinking.exclude`. Значит переход на `vireglass/native` — это не замена импортов,
а удаление локального нативного модуля и сборка Android, которой здесь не на чем проверить.

**Локальная страховка от дрейфа конфигурации.** Удалённый `adapters-density.test.ts` держал
вручную продублированный список полей-«длин» — он ловил тихое расхождение адаптеров. Теперь
эта дисциплина живёт только в ядре, а `check:glsl` и `check:optics` грубее. При подъёме версии
ядра это тот класс регрессий, который здесь не поймается.

**Роспуск шима.** `@vire/vireglass` остаётся прослойкой над ядром. Честнее было бы
импортировать `vireglass` прямо из приложений, а здесь держать только стенд, — это ещё
~25 точек импорта и отдельная задача.

## Чем поведение отличается

Ядро ушло вперёд по измеренному против референсных кадров, но крупное перенесено обратно
сюда заранее — [#123](https://github.com/pruffit/vire/pull/123) (спектральная кромка,
подхват цвета) и [#132](https://github.com/pruffit/vire/pull/132) (лепесток ключевого
света, различимость по телу, насыщение размера). `check:optics` до подмены и после даёт
одни и те же худшие значения — окно 39%, предмет 5.0; сместился только уровень полотна,
на котором ловится худшее окно (0.54 → 0.49).

Приехало вместе с пакетом то, чего в монорепо не было вовсе: путь по живому DOM
(`vireglass/dom`) — преломление настоящей страницы без канваса; спектральная карта, тинт
основного действия, материализация вместо появления через прозрачность; закон
(`vireglass/law`) — калиброванные числа с происхождением каждого.

> **Зависимости ставить правкой `package.json` и `pnpm install` из корня, не
> `pnpm add --filter`.** Фильтрованный `add` при `autoInstallPeers` тащит peers мимо
> `pnpm.overrides` и плодит вторые копии типов RN. См. предупреждение в корневом `CLAUDE.md`.
