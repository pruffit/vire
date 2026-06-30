# Профиль артиста и темизация

## Что делает

Публичная страница артиста со slug-адресом, hero-блоком, дискографией, анонсами и видео. Поддерживает полную кастомизацию внешнего вида через `theme_tokens` JSONB.

**Hero (редизайн §2.7):**
- **Transport** — кнопка «Слушать» запускает весь играбельный каталог артиста (READY-треки
  слышимых релизов, порядок: свежесть релиза → номер трека) в глобальный плеер. Рядом —
  Follow. Кнопка не рендерится, если у артиста нет READY-треков.
- **Mono-ридаут** — строка данных моноширинным: `подписчики · релизы · треки · хронометраж`
  (пустые поля скрываются).
- **Ссылки площадок** — единый габарит (таблетки h-11, тач-таргет 44px); бренд-логотипы
  на белой подложке внутри общей таблетки для читаемости.
- **bio** — цвет через `color-mix(var(--artist-text) …)`, не `opacity` поверх темы (контраст).

**Секции** (`Скоро · Релизы · Площадки · Анонсы · Видео`) — единый темизированный заголовок
`SectionHeader` (mono-eyebrow акцентом + волосяная линия). Вход — CSS `animate-fade-up`
(де-промоутится после анимации; вместо motion-`Reveal`, который оставлял висящий
композит-слой / scroll-jitter). Каскад карточек (релизы/площадки) — `Stagger`.

Темизация:
- `artist_profiles.theme_tokens` — JSONB с CSS-переменными (`--artist-bg`, `--artist-text`, `--artist-accent` и др.)
- На странице `/artists/[slug]` переменные инжектируются как inline `style` в корневой `<div>`
- Компоненты используют `bg-[var(--artist-bg)]`, `text-[var(--artist-text)]` — без форков кода
- Grain-эффект (CSS-шум) включается флагом в теме
- Шрифт страницы задаётся через токен `--artist-font-family` (Google Fonts или системный)

## Где код

- **Страница:** `apps/web/app/(listener)/artists/[slug]/page.tsx` — SSR, `generateMetadata`,
  инжекция CSS-переменных темы, hero + секции (`ArtistHero`, `SectionHeader`, `*Section`)
- **Запрос каталога:** `getArtistPlayableTracks(artistProfileId)` в
  `packages/db/src/queries/discovery.ts` — READY-треки слышимых релизов для play-all и ридаута
- **Кнопка play:** переиспользуется `apps/web/components/release-hero-play.tsx`
  (`ReleaseHeroPlay`, темизирована, `controls.play` из `player/audio-engine`)
- **Форматтеры ридаута:** `apps/web/lib/format.ts` (`formatCount`, `plural*`, `totalDuration`)
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
