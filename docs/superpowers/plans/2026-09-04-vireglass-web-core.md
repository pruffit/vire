# План: VireGlass в вебе (ядро, SDK, стенд /rnd)

Спека: `docs/superpowers/specs/2026-09-04-vireglass-web-core.md`. Карта портируемости снята
чтением кода 04.09.2026.

**Статус на 04.09.2026:** фазы 1–5 и 7 сделаны, фаза 6 (доводка оптики) начата — закрыты
базовые критерии приёмки и полярность надписи. Что осталось открытым, перечислено в
`docs/features/vireglass-web.md`, раздел «Ограничения».

## Фаза 1. Пакет `@vire/vireglass` и переезд модели

Каркас (`package.json`, `tsconfig.json`) уже создан. Переносятся **целиком, без правок логики**:

| Откуда | Куда | Что менять |
|---|---|---|
| `apps/mobile/lib/vireglass/optics.ts` | `packages/vireglass/src/optics.ts` | ничего |
| `apps/mobile/lib/vireglass/material.ts` | `packages/vireglass/src/material.ts` | ничего |
| `apps/mobile/lib/vireglass/geometry.ts` | `packages/vireglass/src/geometry.ts` | ничего |
| `apps/mobile/lib/vireglass/adaptation.ts` | `packages/vireglass/src/adaptation.ts` | ничего (зависит от `react`, не от `react-native`; `rAF` есть в браузере) |
| `apps/mobile/lib/vireglass/group-model.ts` | `packages/vireglass/src/group-model.ts` | ничего |
| `apps/mobile/lib/vireglass/sdf.ts` | `packages/vireglass/src/sdf.ts` | ничего (строка-константа) |
| `apps/mobile/lib/vireglass/lens-shader.ts` | `packages/vireglass/src/lens-shader.ts` | ничего |
| `apps/mobile/lib/vireglass/surface-shader.ts` | `packages/vireglass/src/surface-shader.ts` | ничего |
| `apps/mobile/lib/vireglass/adapters.ts` | `packages/vireglass/src/adapters.ts` | **единственная правка:** убрать `import { PixelRatio } from 'react-native'`, плотность приходит аргументом |

`adapters.ts` — сигнатуры становятся `toLensProps(material, geometry, density, …)` и
`toSurfaceUniforms(…, density)`. Мобильные вызовы передают `PixelRatio.get()`, веб —
`devicePixelRatio`. Мемоизацию формы массива униформ (`channel()`, `Map` по длине) переносим
как есть: она держит identity пропа для моста Reanimated. Вебу она не нужна, но и не мешает.

**Остаются в мобилке:** `environment.ts` (expo-sensors), `glass-ink.tsx`, `components/**`,
`modules/glass-lens/**`.

Мобильные `lib/vireglass/*.ts` превращаются в ре-экспорты из пакета — так диф мобилки
минимален и её текущая незакоммиченная работа не задета. `apps/mobile/package.json` получает
`"@vire/vireglass": "workspace:*"`; Metro резолвит workspace-пакеты с `exports` (проверено:
`unstable_enablePackageExports: true` в `metro.config.js`).

**Тесты.** `lib/__tests__/vireglass-material.test.ts` парсит `GlassLensModule.kt`/`GlassLensView.kt`
— остаётся в мобилке, там же и живёт натив. Чистые тесты модели (адаптация, группы) переезжают
в `packages/vireglass/src/__tests__/`. Ни один тест не переписывается — только пути импортов.

**Готово, когда:** `pnpm --filter @vire/vireglass test`, `typecheck` зелёные; мобильные тесты
зелёные тем же составом, что до переезда.

## Фаза 2. Цель GLSL

`packages/vireglass/src/targets/glsl.ts` — перевод текста шейдера по таблице из спеки §4.
Не регексп-замена вслепую: транспайлер работает по списку правил, каждое правило — отдельная
функция с тестом.

Правила: типы (`float2/3/4`→`vec2/3/4`, `half*`→`float`/`vec*`), entry point
(`half4 main(float2 xy)` → `void main()` + `out vec4 fragColor`, координата из `gl_FragCoord`
с флипом Y), ранние `return X` → `fragColor = X; return;`, `uniform shader` → `uniform sampler2D`,
`.eval(c)` → `texture(s, c / u_contentSize)`, пролог `#version 300 es` + `precision highp float;`.

**Тест-паритет** (`targets.test.ts`): обе цели получают один вход; проверяется, что множества
имён униформ совпадают, что в GLSL-выходе не осталось ни одного `half`/`float2`/`.eval(`, и
что `main` ровно один и с корректной сигнатурой. Отдельный тест — что каждая униформа из
контракта присутствует в обеих целях (рассинхрон имён однажды уже держал преломление
выключенным целую фазу).

## Фаза 3. WebGL2-рендерер

`packages/vireglass/src/web/` (подпуть `@vire/vireglass/web`): `renderer.ts`, `probe.ts`,
`scene.ts`. Четыре прохода — сцена в FBO, даунсемпл для зонда, линза, поверхность.

Решения, зафиксированные спекой и обязательные к соблюдению:

- всё в device-px: поверхностные униформы тоже множатся на `devicePixelRatio` (на Android их
  спасали два координатных пространства, здесь пространство одно);
- линза и поверхность сводятся к общему центру — на Android у них разные запасы
  (`lensPadDp` против `surfacePadDp`) и концентричность держится конвенцией компонента;
- `content`-текстура: `LINEAR`, без мипмапов;
- зонд читает через PBO с `fenceSync`, не синхронным `readPixels`;
- `u_contentMin/u_contentMax` задаёт владелец FBO — это границы сцены, системного аналога нет.

**Готово, когда:** стекло на канвасе, зонд отдаёт статистику, debug-режимы `sdf`/`normals`
показывают корректную геометрию (не зеркальную — проверка флипа Y).

## Фаза 4. Стенд `/rnd`

- `apps/web/public/rnd/index.html` + бандл движка (esbuild из `packages/vireglass`),
  rewrite `/rnd` → этот файл в `next.config.ts`; `noindex` метатегом в самой странице;
- ветка `/rnd` в `apps/web/proxy.ts` (`x-desktop-chrome: none`) уже стоит — она перестаёт
  быть нужной для статики, но остаётся дешёвой страховкой, если стенд когда-нибудь вернётся
  в React;
- состояние в URL: `zone`, `preset`, `debug`, плюс любой параметр материала по имени;
- зоны фона переносятся с `apps/mobile/screens/material-lab.tsx`: чёрное, белое, почти-чёрный
  и почти-белый градиенты, граница, шахматка, мелкий текст, насыщенные цвета, список с обложками;
- слайдеры по `MATERIAL_RANGES` (причины), таблица следствий рядом — только на чтение;
- тумблеры эффектов и 12 debug-режимов.

Запрет по CLAUDE.md: никаких `min-h-screen`/`h-screen`. Канвас берёт высоту от скролл-области.

## Фаза 5. Probe

`apps/web/scripts/glass-probe.mjs` на Playwright: `capture`, `stats`, `band`, `sweep`, `diff`.
Меряет пару «внутри стекла / рядом снаружи» — иначе метрика не отличает чистый рендер от
стекла, которому нечего показать (на Android так пропустили целую серию недействительных замеров).

## Фаза 6. Доводка оптики

Итерации по критериям приёмки спеки §10. Ведётся журналом в `docs/vireglass/web-lab.md`
в том же формате, что `material-lab.md`: гипотеза → наблюдение → решение.

## Фаза 7. SDK

Публичный API пакета, пресеты, `docs/features/vireglass-web.md`. Открытый вопрос про стекло
над живым DOM (спека §9) решается здесь, на фактах фазы 6.

## Порядок и делегирование

Фазы строго последовательны: 2 не имеет смысла без 1, 3 без 2, 5 без 4. Реализация уходит
сабагентам (Sonnet) по одному срезу за раз; фаза 6 — доводка картинки — остаётся в главной
сессии, это суждение, а не механика.

## Среда: как гонять стенд

Проверено 04.09.2026 на этом дереве:

- **Прод-режим гидрируется, dev-режим — нет.** Прод (`next build` + сервер): React стартует,
  эффекты идут, канвас получает device-px. Dev на Turbopack: HTML и все 35 клиентских чанков
  приезжают без единой ошибки в консоли, CSP разрешает inline, отклонённых промисов нет —
  но React не стартует вовсе: ни одного `__reactFiber` на дереве, `useEffect` не вызывается.
  То же самое на `/design`, то есть проблема не в стенде, а в окружении. Проверено и
  исключено: очистка `.next/dev`, headless против headed, блокировка HMR-сокета. Рукопожатие
  HMR при этом само по себе исправно — curl получает `101 Switching Protocols`, а Chromium на
  том же адресе `ERR_INVALID_HTTP_RESPONSE`.
- **Статические страницы в dev при этом работают.** Файл из `public/` с обычным
  `<script type="module">` выполняется и получает WebGL2-контекст — проверено. React в dev
  мёртв, ванильный JS жив.
- **Правило на время работы:** один dev-сервер за раз, и не запускать `build`, пока он жив.
  `next dev` переживает остановку своей оболочки — порт держит уцелевший процесс, а новый
  сервер молча уезжает на 3001, и дальше меряется не то, что правится.
- Прод-проверка: `next start` предупреждает про `output: standalone` — окончательный
  прогон делать через `node .next/standalone/apps/web/server.js`, как в CI-смоуке.
- Установлен Next 16.2.11, dev-сервер сам сообщает об ожидаемом 16.3.4. Апгрейд —
  первый кандидат на проверку, когда до поломки dev дойдут руки; в этой работе не трогаем.

### Следствие для стенда: он не React-страница

Стенд перестаёт зависеть от гидрации: `apps/web/public/rnd/index.html` плюс бандл движка,
собираемый esbuild из `packages/vireglass`; роут `/rnd` — rewrite на этот файл. Причины,
помимо мёртвого dev: лаборатория и не должна тащить оболочку приложения (на Android стенд
ровно так же **заменяет собой приложение**), пересборка esbuild занимает миллисекунды против
4.2 минут у `next build`, а измеряемый кадр не содержит ничего, кроме самого материала.

Продовые веб-компоненты, которые появятся после фазы 7, — обычные React-компоненты; к тому
времени поломку dev придётся починить, но стенд от неё уже не зависит.

## Гейты

После каждой фазы: `pnpm --filter @vire/vireglass typecheck test`, а после фаз 4–5 ещё
`pnpm --filter @vire/web typecheck lint check:routes test build` и `audit:design`.
