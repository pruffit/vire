# План: вынос VireGlass в open source

Спека — `docs/superpowers/specs/2026-09-19-vireglass-open-source.md`.
Новый репозиторий собирается в `C:\Users\KOTLAEV\vireglass`, исходники берутся
из `origin/fix/vireglass-reference-gaps`.

## Срез 1 — скелет репозитория (главная сессия)

`git init`, раскладка, `package.json` (`vireglass`, Apache-2.0, три экспорта),
`tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore` (в нём `.reference/`),
`LICENSE`, CI `.github/workflows/ci.yml` (typecheck + test + check:glsl + check:optics +
build), релизный `release.yml` под `NPM_TOKEN`. Исходники копируются без правок — их
переводят следующие срезы.

Раскладка: `src/` (ядро), `src/web/`, `src/native/` (RN-компоненты), `android/`
(Kotlin), `scripts/`, `docs/`.

## Срез 2 — ядро на английский

`src/*.ts` кроме `web/` и `__tests__/`. Комментарии и JSDoc на английский, таблица
переименований из спеки применяется целиком. Длинные блоки оптической теории из
`lens-shader.ts` и `surface-shader.ts` вынимаются в `docs/optics.md`, в коде остаётся
ссылка в 1–2 строки. Правило «комментарии почти никогда» для публичного SDK не действует
буквально: остаётся то «почему», без которого число в шейдере не проверить.

## Срез 3 — веб и гейты

`src/web/{renderer,probe,gl,reference-draw}.ts` и `scripts/{check-glsl,check-optics,
measure-reference}.mjs`. Вывод гейтов — на английский: он попадёт в логи CI публичного
репозитория. `measure-reference.mjs` ходит на стенд `/rnd`, которого в пакете нет, —
он остаётся, но README честно говорит, что гейт сверки платформ требует стенда.

## Срез 4 — тесты

`src/__tests__/*.ts` — имена `describe`/`it` на английский, переименования применены.
Числа и допуски не трогать: это калибровка, а не текст. Зелёный прогон 180 тестов —
критерий приёмки среза.

## Срез 5 — натив

`android/src/main/java/expo/modules/glasslens/*.kt` (4 файла), `expo-module.config.json`,
JS-обёртка, `src/native/{glass-surface,glass-group,glass-ink,environment}.tsx|ts`.
Комментарии на английский, относительные импорты переписать под новую раскладку.
Ворклеты не пребандлить — `native` уходит исходником.

## Срез 6 — документация

`README.md` (установка, минимальный пример, модель материала, честный раздел
ограничений из спеки), `docs/optics.md` (теория из шейдеров), `docs/architecture.md`,
`docs/adr-001-rendering.md`, `docs/platform-parity.md`, `docs/benchmarks.md`,
`CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`. Пишутся по русским оригиналам
`docs/vireglass/**`, но для внешнего читателя, а не переводом строка-в-строку.
`material-lab.md` (1300 строк журнала экспериментов) в v0.1.0 не едет.

## Срез 7 — проверка и релиз

Установка с нуля, все гейты, сборка. Публичный репозиторий `pruffit/vireglass`,
push, тег `v0.1.0`, GitHub release. npm — по команде Danya, токен его.

## Порядок

Срез 1 первым. Срезы 2–5 независимы по файлам и параллелятся; срез 6 опирается на 2–3
(теория вынимается из кода). Срез 7 последний.

## Что остаётся в монорепо

`packages/vireglass` живёт как есть до появления пакета в реестре. После публикации —
отдельная задача: переезд потребителей (`apps/web/rnd-src`, `apps/mobile`) на `vireglass`,
включая таблицу переименований из спеки.
