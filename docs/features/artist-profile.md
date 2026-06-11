# Профиль артиста и темизация

## Что делает

Публичная страница артиста со slug-адресом, hero-блоком, дискографией, анонсами и видео. Поддерживает полную кастомизацию внешнего вида через `theme_tokens` JSONB.

Темизация:
- `artist_profiles.theme_tokens` — JSONB с CSS-переменными (`--artist-bg`, `--artist-text`, `--artist-accent` и др.)
- На странице `/artists/[slug]` переменные инжектируются как inline `style` в корневой `<div>`
- Компоненты используют `bg-[var(--artist-bg)]`, `text-[var(--artist-text)]` — без форков кода
- Grain-эффект (CSS-шум) включается флагом в теме
- Шрифт страницы задаётся через токен `--artist-font-family` (Google Fonts или системный)

## Где код

- **Страница:** `apps/web/app/artists/[slug]/page.tsx` — SSR, `generateMetadata`
- **Лейаут:** `apps/web/app/artists/[slug]/layout.tsx` — инжекция CSS-переменных
- **Компонент hero:** `apps/web/app/artists/[slug]/_components/`
- **Виджет темизации (дашборд):** `apps/web/app/dashboard/profile/_components/ThemePicker.tsx` — live color picker + пресеты
- **API профиля:** `apps/web/app/api/v1/dashboard/profile/route.ts`
- **Сервис:** `packages/core/src/services/artist.service.ts`
- **Репозиторий:** `packages/core/src/repositories/artist.repository.ts`
- **DB таблицы:** `artist_profiles` (`packages/db/src/schema/artists.ts`)
  - `slug`, `display_name`, `bio`, `avatar_url`, `header_url`
  - `theme_tokens` JSONB
  - `is_verified`, `is_active` (активен на витрине)
  - `social_links` JSONB

## Env-переменные

```
S3_PUBLIC_ENDPOINT=             # для отображения аватаров/обложек через next/image
```

## Известные ограничения

- Grain и шрифты рендерятся только на публичной странице, не в плеере
- Смена slug приведёт к 404 на старых ссылках — slug не меняется после создания
- `is_active=false` скрывает артиста с каталога, но прямая ссылка работает
