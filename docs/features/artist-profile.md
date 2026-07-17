# Профиль артиста и темизация

## Что делает

Публичная страница артиста со slug-адресом. Поддерживает полную кастомизацию внешнего
вида через `theme_tokens` JSONB.

**Макет (редизайн v2, §2.7):** полноширинный двухколоночный (не узкое центрирование).
- **Баннер сверху** (`ArtistBanner`) — полноширинный. Если у артиста загружена **широкая
  обложка** (`header_url`) — показывается резко, edge-to-edge, с нижним fade в `--artist-bg`.
  Иначе — ambient-фолбэк: размытая обложка первого релиза + радиальный accent-градиент.
  Статичный (не sticky), grain-aware. Загрузка обложки — в дашборде профиля (multipart,
  S3 `headers/{artistId}.{ext}`, политика `HEADER_POLICY`: пейзаж, до 10 МБ, рекомендация ~3:1).
- **Левая колонка — «карточка артиста»** (`ArtistIdentity`), `lg:sticky` (внутри
  app-shell-скроллера `#main-content` — инвариант не нарушается): аватар (accent-glow,
  фолбэк — моно-инициал), имя (кламп кегля по длине слова), `VerifiedBadge`, bio
  (через `color-mix(var(--artist-text) …)`, не `opacity`), **transport** (`ReleaseHeroPlay`
  = play-all каталога: READY-треки слышимых релизов, порядок свежесть → номер; не
  рендерится без READY-треков) + Follow, mono-ридаут (`релизы · треки · хронометраж`),
  ряд ссылок (таблетки h-11, тач-таргет 44px; бренд-логотипы на белой подложке).
  На мобилке колонка становится верхним блоком; `ArtistCollapseBar` (компактная полоска
  при скролле) показывается только <lg, сентинел стоит после карточки.
- **Правая колонка — лента контента**, порядок под вовлечение:
  `Скоро → Популярное → Релизы → Площадки → Анонсы → Видео` (пустые секции скрыты).

**Блок «Популярное»** (`ArtistPopularTracks`, `'use client'`) — играбельный трек-лист
артиста по числу прослушиваний: top-5 + тоггл «Все треки (N)». Клик по строке играет
(`controls.play`), повторный по активной — pause/resume; лайк на строке (`PlayerLikeButton`).
Сортировка — чистый `topByPlays` (стабильна: при равных plays — порядок каталога, поэтому
у нового артиста = каталог). Источник — `getArtistPlayableTracks`, обогащённый агрегатом
`plays`; один запрос обслуживает и play-all (порядок каталога), и «Популярное» (копия
массива, отсортированная по plays).

**Секции** — единый темизированный заголовок `SectionHeader` (mono-eyebrow акцентом +
волосяная линия). Вход — CSS `animate-fade-up` (де-промоутится после анимации; вместо
motion-`Reveal`, оставлявшего висящий композит-слой / scroll-jitter). Каскад карточек —
`Stagger`. Индикатор «сейчас играет» — общий `PlayingBars` (переиспользуется трек-листом
релиза).

Темизация:
- `artist_profiles.theme_tokens` — JSONB с CSS-переменными (`--artist-bg`, `--artist-text`, `--artist-accent` и др.)
- На странице `/artists/[slug]` переменные инжектируются как inline `style` в корневой `<div>`
- Компоненты используют `bg-[var(--artist-bg)]`, `text-[var(--artist-text)]` — без форков кода
- Grain-эффект (CSS-шум) включается флагом в теме
- Шрифт страницы задаётся через токен `--artist-font-family` (Google Fonts или системный)

## Где код

- **Страница:** `apps/web/app/(listener)/artists/[slug]/page.tsx` — SSR, `generateMetadata`,
  инжекция CSS-переменных темы, двухколоночный макет (`ArtistBanner`, `ArtistIdentity`,
  `SectionHeader`, `*Section`)
- **Блок «Популярное»:** `apps/web/app/(listener)/artists/[slug]/artist-popular-tracks.tsx`
  (`'use client'`); сортировка — `apps/web/lib/artist-tracks.ts` (`topByPlays`, покрыт тестом)
- **Запрос каталога:** `getArtistPlayableTracks(artistProfileId)` в
  `packages/db/src/queries/discovery.ts` — READY-треки слышимых релизов + агрегат `plays`
  (для play-all, ридаута и «Популярного»)
- **Кнопка play:** переиспользуется `apps/web/components/release-hero-play.tsx`
  (`ReleaseHeroPlay`, темизирована, `controls.play` из `player/audio-engine`)
- **Индикатор «играет»:** `apps/web/components/playing-bars.tsx` (`PlayingBars`, общий
  с трек-листом релиза)
- **Форматтеры ридаута:** `apps/web/lib/format.ts` (`formatCount`, `plural*`, `totalDuration`)
- **Виджет темизации:** `apps/web/components/theme-editor.tsx` (`ThemeEditor`, controlled) —
  пресеты, live color picker, шрифты, зерно, превью страницы; общий для дашборда
  (`apps/web/app/dashboard/profile/edit-profile-form.tsx`) и **админ-редактора артиста**
  (`/admin/artists/[id]/edit`, минуя ownership-гард дашборда — правит любой профиль)
- **API профиля:** `apps/web/app/api/v1/dashboard/profile/route.ts`
- **Сервис:** `packages/core/src/services/artist.service.ts`
- **Репозиторий:** `packages/core/src/repositories/artist.repository.ts`
- **Загрузка обложки/аватара:** `apps/web/app/api/v1/dashboard/profile/route.ts`
  (multipart; `header`/`removeHeader`, `avatar`/`removeAvatar`); политики — `apps/web/lib/image.ts`
  (`HEADER_POLICY`, `AVATAR_POLICY`); форма — `apps/web/app/dashboard/profile/edit-profile-form.tsx`
- **DB таблицы:** `artist_profiles` (`packages/db/src/schema/artists.ts`)
  - `slug`, `name`, `bio`, `avatar_url`, `header_url` (широкая обложка, миграция 0028)
  - `theme_tokens` JSONB, `links`/`videos` JSONB
  - `verified`, `is_active` (активен на витрине)

## Env-переменные

```
S3_PUBLIC_ENDPOINT=             # для отображения аватаров/обложек через next/image
```

## Известные ограничения

- Grain и шрифты рендерятся только на публичной странице, не в плеере
- Смена slug приведёт к 404 на старых ссылках — slug не меняется после создания
- `is_active=false` скрывает артиста с каталога, но прямая ссылка работает

## Видимость пустого артиста

Артист без ни одного трека в PUBLISHED-релизе (предикат `artistHasPublishedTrack`,
`packages/db/src/queries/artists.ts`) скрыт из каталога, поиска и sitemap — тот же
предикат отдаёт 404 при прямом заходе на `/artists/[slug]`. Исключения: участник
профиля (`artist_members`) и роли `MODERATOR`/`ADMIN`/`SUPERADMIN`. Проверка —
`assertArtistVisible` в `page.tsx`, вызывается и из `ArtistPage`, и из `generateMetadata`
(чтобы title/OG пустого артиста не утекали в превью); решение — чистая функция
`canViewEmptyArtist` в `apps/web/lib/artist-visibility.ts`.
