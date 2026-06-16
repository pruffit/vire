# Иконки (система икон + бренд-логотипы)

Единый набор иконок для всего приложения. Два слоя с разной природой:

- **Системные** — монохром, наследуют цвет текста (`currentColor`), один общий спрайт.
- **Бренд-логотипы** — цветные лого соцсетей и стримингов (как у площадки), по файлу
  на бренд (свои градиенты/цвета перекрашивать нельзя).

## Что делает

- `Icon` (`components/icon.tsx`) — системная иконка из спрайта `<use href="#vire-<name>">`.
  Монохром через `currentColor`, размер `size` (px). Имена — `IconName`.
- `BrandIcon` (`components/brand-icon.tsx`) — бренд-логотип фиксированной высоты `size`,
  ширина auto по пропорциям (одинаково корректно для квадратных глифов и широких
  вордмарков). Декоративный по умолчанию (`alt=''`); подпись — через `label`.
  Списки `SOCIAL_BRANDS` / `STREAMING_BRANDS`, названия — `BRAND_LABELS`.

## Где код

- **Источник правды:** папка `icons/` в корне репо — `system/`, `social/`, `streaming/`
  (раскладка и конвенции описаны в `icons/README.md`).
- **Сборка:** `scripts/build-icons.mjs` (без зависимостей, `pnpm icons:build`):
  - `icons/system/*.svg` → `apps/web/public/icons/system-sprite.svg` (118 символов);
  - `icons/{social,streaming}/*.svg` → чистит и копирует в
    `apps/web/public/icons/brands/<name>.svg`;
  - генерит `apps/web/components/icon-manifest.generated.ts` (списки имён — один
    источник правды для `Icon`/`BrandIcon`).
- **Компоненты:** `apps/web/components/icon.tsx`, `apps/web/components/brand-icon.tsx`.
- **Бренды:** social — telegram, discord, vk, instagram, x, facebook, youtube, bluesky,
  bandlab, bandsintown, tiktok, twitch; streaming — spotify, apple-music, youtube-music,
  yandex-music, vk-music, kion-music, zvuk, deezer, tidal, soundcloud, bandcamp,
  amazon-music.

## Env

- Не требуется (статика в `public/`).

## Ограничения / на будущее

- Бренд-логотипы рендерятся тегом `img` (не спрайтом и не `next/image`): у них свои
  `<style>`/градиенты/`id`, которые в общем спрайте конфликтуют, а перекрашивать их
  не нужно. Поэтому `currentColor` к ним неприменим.
- Добавить новый бренд: положить `kebab-case.svg` в `icons/social|streaming`, прогнать
  `pnpm icons:build`, добавить подпись в `BRAND_LABELS`.
- Кнопки лендинга смартлинка уже на `BrandIcon` (`PLATFORM_BRAND` мапит
  `PlatformKey → BrandName`, `isBrandWordmark` решает «лого вместо подписи»). Хаб
  артиста остаётся на монохромных глифах `platform-icon.tsx`. См. `smart-links.md`.
- `icons/Icons.svg` — мастер-экспорт системных иконок из Figma (для перерисовки пака).
