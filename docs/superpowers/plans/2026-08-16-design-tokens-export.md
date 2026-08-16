# План — экспорт дизайн-токенов

Спека: `docs/superpowers/specs/2026-08-16-design-tokens-export-design.md`.

## Шаги

1. **Пакет `packages/design-tokens`**
   - `package.json`: имя `@vire/design-tokens`, `private: true`, скрипты `build` (запускает
     `scripts/build.mjs`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`). Зависимость
     от `@vire/config` (tsconfig preset), `vitest`, `typescript` — как в других пакетах
     (сверить с `packages/ui/package.json`/`packages/core/package.json` за образец).
   - `tsconfig.json` — `extends` из `@vire/config/tsconfig/library.json` (сверить, как это
     сделано в соседних пакетах).
   - `src/tokens.json` — 15 цветовых токенов + `radius`, значения взять **буквально** из
     текущего `packages/ui/src/globals.css` (`:root` блок), разложить OKLCH-строку `oklch(L C H)`
     на `{ l, c, h }`, `radius: 0.375rem` → `6` (px, `0.375 * 16`).
   - `scripts/build.mjs` — node-скрипт (ESM), читает `tokens.json`, пишет:
     - `dist/tokens.css` — `:root { --background: oklch(...); ...; --radius: 0.375rem;
       --radius-sm: calc(var(--radius) - 2px); ...}` (сохранить ИМЕНА переменных и формулу
       radius-вариантов 1:1 с сегодняшним `globals.css`, чтобы диф в браузере был нулевым).
     - `dist/tokens.ts` — `export const tokens = { color: { background: {l,c,h}, ... },
       radius: { base: 6 } } as const;` + `export type DesignTokens = typeof tokens;`.
   - `package.json` экспортирует `./tokens.css` → `./dist/tokens.css`, `.` → `./dist/tokens.ts`
     (условные `exports`, сверить синтаксис с `packages/storage/package.json` или похожим).

2. **Round-trip тест** (`packages/design-tokens/src/build.test.ts` или `scripts/build.test.ts`,
   Vitest): собрать токены в temp-директорию (или прогнать генератор в памяти, если код
   генерации вынесен в чистую функцию `generateCss(tokens)`/`generateTs(tokens)` отдельно от
   IO — предпочтительно, легче тестировать), распарсить получившийся CSS обратно в числа,
   сравнить с исходным `tokens.json`. Чистые функции генерации — не завязывать на файловую
   систему, `build.mjs` — только IO-обвязка вокруг них.

3. **Подключение в `packages/ui`**
   - `packages/ui/package.json` — добавить зависимость `@vire/design-tokens` (workspace).
   - `packages/ui/src/globals.css` — заменить хардкод `:root {...}` (кроме `--artist-*` —
     они остаются, это рантайм-фолбэк, не токен) на `@import "@vire/design-tokens/tokens.css";`
     первой строкой файла. Если Tailwind v4 / Lightning CSS не резолвит `@import` пакета из
     другого workspace — генератор кладёт копию сразу в
     `packages/ui/src/generated/tokens.css` (добавить в `.gitignore` пакета `ui`, генерируется
     сборкой), `globals.css` импортирует относительным путём. Проверить эмпирически, не
     гадать — потратить на это отдельный прогон `pnpm --filter @vire/web dev` и посмотреть,
     применяются ли стили.
   - `turbo.json`: таск `build` пакета `@vire/ui` (если такой есть) или `@vire/web` должен
     зависеть от `@vire/design-tokens#build` (`dependsOn: ["^build"]` — проверить, уже ли
     это покрыто дефолтным правилом turbo, обычно да для внутренних воркспейс-зависимостей).

4. **Сверка отсутствия визуального дрейфа**
   - Собрать `pnpm --filter @vire/design-tokens build`, прогнать `pnpm --filter @vire/web dev`,
     открыть главную — визуально ничего не должно измениться (тот же тёмный фон, тот же
     тёплый нейтраль). Не полагаться только на глаз: сравнить итоговый вычисленный
     `getComputedStyle(document.documentElement).getPropertyValue('--background')` до/после
     правки (можно через простой ручной прогон в консоли браузера или Playwright-скрипт,
     как в замере волны 8) — либо, если это избыточно, тест на уровне сравнения текста
     сгенерированного `tokens.css` с git-историей старого `globals.css` (значения совпадают
     посимвольно после форматирования).

5. **Тесты и гейты**
   - `pnpm --filter @vire/design-tokens typecheck && test`
   - `pnpm --filter @vire/web typecheck && lint && check:routes && test && build`
   - `pnpm --filter @vire/web audit:design` — визуальный результат не должен был измениться,
     но прогон обязателен, раз тронут источник цвета/радиуса всей платформы.
   - `pnpm turbo run check:layers` — новый пакет не должен спутать границы (он вне
     `packages/core`, но лучше прогнать до кучи).

6. **Документация**
   - `docs/features/design-tokens.md` — новый файл по шаблону `docs/features/README.md`:
     что делает, где код, как добавить/поменять токен, ограничения (spacing/duration не
     токенизированы, артист-тема отдельно).
   - `docs/multiplatform.md` §6 и §12 — отметить пункт 5 сделанным (аналогично тому, как
     `docs/migration-plan.md` уже отмечает волну 8 ✅).

## Модель/делегирование

Реализация (шаги 1–4) — один сабагент Sonnet, план уже содержит все пути и решения.
Самокритика — один прогон Sonnet после реализации: проверить round-trip тест не тавтологичен
(не сравнивает сгенерированное само с собой в обход исходника), проверить, что
`globals.css` действительно перестал быть источником значений (не задублировал токены
одновременно в JSON и в CSS-файле руками — тогда дрейф просто переехал в другое место),
проверить `audit:design` реально прогнан и зелёный, не просто предположен.
