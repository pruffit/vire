# Дизайн-токены

Платформо-нейтральный источник цветовых и радиус-токенов: `packages/design-tokens/src/tokens.json`
— единственное место, где меняют значение; генераторы отдают его как CSS (веб) и TS-объект
(будущий React Native клиент). Основание — `docs/multiplatform.md` §6, §12 (пункт 5).

## Что делает

- `tokens.json` хранит 18 цветовых токенов (OKLCH-тройка `{ l, c, h }`: `background`,
  `foreground`, `card`/-foreground, `popover`/-foreground, `primary`/-foreground,
  `secondary`/-foreground, `muted`/-foreground, `accent`/-foreground, `destructive`, `border`,
  `input`, `ring`) и `radius` (базовое значение в px).
- `pnpm --filter @vire/design-tokens build` генерирует `dist/tokens.css` (`:root { --background:
  oklch(...); ... }`, radius в rem — те же имена переменных, что раньше были захардкожены в
  `packages/ui/src/globals.css`) и `dist/tokens.ts` (`export const tokens = {...} as const`,
  radius раскрыт в `sm`/`md`/`lg`/`xl` по формуле `base-2`/`base`/`base+4`/`base+8`).
- `packages/ui/src/globals.css` подключает `dist/tokens.css` через `@import
  "@vire/design-tokens/tokens.css";` первой строкой — сам больше не хранит значения. Tailwind v4
  (`@theme inline`) и компонентный CSS (`@utility`/`@layer base`) остаются в `globals.css` как
  есть, `@import` резолвится Lightning CSS как обычный пакет из workspace `node_modules`
  (проверено эмпирически: dev-сервер, `_next/static/chunks/*.css` содержит те же значения,
  что раньше были в коде).

## Где код

- **Пакет:** `packages/design-tokens/` — `src/tokens.json` (источник), `src/generate.ts` (чистые
  функции `generateCss`/`generateTs`, без файлового IO), `scripts/build.mjs` (IO-обвязка: читает
  `tokens.json`, пишет `dist/`).
- **Потребитель (веб):** `packages/ui/src/globals.css` — `@import "@vire/design-tokens/tokens.css"`.
  `packages/ui/package.json` зависит от `@vire/design-tokens` (workspace).
- **Тесты:** `packages/design-tokens/src/generate.test.ts` — round-trip (JSON → сгенерированный
  CSS/TS-текст → распарсено обратно в числа → сравнение с исходником, независимой от
  `generate.ts` таблицей имён CSS-переменных).

## Как добавить/поменять токен

1. Править только `packages/design-tokens/src/tokens.json`.
2. Если это новый цветовой токен — добавить ключ в `Tokens['color']` (`src/generate.ts`) и в
   `CSS_VAR_NAMES`/`EXPECTED_CSS_VARS` (kebab-case имя переменной).
3. `pnpm --filter @vire/design-tokens build` — обновит `dist/tokens.css` и `dist/tokens.ts`.
4. `pnpm --filter @vire/design-tokens test` — round-trip тест ловит расхождение имён/значений.

## Env

- Не требуется.

## Ограничения / на будущее

- **Токенизированы только цвет и radius** — ровно то, что уже было платформенным токеном в
  `globals.css`. Spacing/duration не токенизированы: отдельного платформенного значения под них
  в коде нет, заводить сейчас — абстракция без потребителя.
- **Артист-тема (`--artist-bg`/`--artist-text`/`--artist-accent`) не входит в этот пакет.** Это
  рантайм-фолбэк на платформенные токены (`packages/ui/src/globals.css`, `:root` после импорта),
  значения приходят per-артист из `artist_profiles.theme_tokens` в БД — не статичны.
- **Цвет хранится структурно (`{l,c,h}`), не строкой `oklch(...)`.** CSS-генератор форматирует в
  `oklch(l c h)`; TS-генератор отдаёт тройку как есть — конвертация в RN-совместимый формат
  (hex/rgb) не написана: второго реального потребителя ещё нет, писать конвертер без вызывающей
  стороны преждевременно.
- **`dist/` — генерируется, не в git** (`.gitignore` корня уже игнорирует `dist/` глобально).
  `pnpm --filter @vire/web build`/Docker-сборка (`apps/web/Dockerfile`) вызывают
  `pnpm --filter @vire/web build` напрямую, минуя turbo-граф `^build` — оба места собирают
  `@vire/design-tokens` отдельным шагом перед сборкой веба (см. `.github/workflows/deploy.yml`,
  `apps/web/Dockerfile`). При `turbo run build` порядок и так корректен: `@vire/ui` зависит от
  `@vire/design-tokens` в `package.json`, turbo обходит граф транзитивно.
- React Native клиента, который бы реально импортировал `dist/tokens.ts`, в репозитории пока нет
  — TS-генератор сегодня проверяется только тестами внутри монорепо.
