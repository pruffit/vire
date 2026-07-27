# SEO и структурированные данные

## Что делает

Полноценное SEO для публичных страниц: метатеги, Open Graph, Twitter Card, structured data (JSON-LD), sitemap, robots.

### Метатеги

- `metadataBase` задаётся из `NEXT_PUBLIC_SITE_URL` → `AUTH_URL` → `http://localhost:3000` (`apps/web/lib/site.ts`)
- Шаблон заголовков: `%s — Vire` (через `title.template` в корневом `layout.tsx`)
- Дефолтные OG/Twitter в `app/layout.tsx`

### `generateMetadata` на страницах

| Страница | Schema.org type | OG type |
|---|---|---|
| `/artists/[slug]` | `MusicGroup` | `profile` |
| `/artists/[slug]/releases/[id]` | `MusicAlbum` | `music.album` |
| `/artists/[slug]/releases/[id]/tracks/[id]` | `MusicRecording` | `music.song` |
| `/playlists/[id]` (только PUBLIC) | `MusicPlaylist` | `music.playlist` |

- Canonical URL включён в каждую страницу
- Метаданные собираются хелпером `lib/metadata.ts`, а не вручную: Next мёржит их
  **поверхностно** — свой `openGraph` на странице заменяет родительский целиком
  (siteName/locale/файловая картинка теряются)

### OG-картинки — брендовые карточки

Артист, релиз, трек, смартлинк и плейлист рендерят свою картинку 1200×630 через файловую
конвенцию `opengraph-image.tsx` (satori/`next/og`, `runtime: 'nodejs'`, `revalidate: 300`).
Карточка одна на все пять поверхностей — `lib/og/card.tsx` (`ogCard`, `ogFallbackCard`).

- Обложка не отдаётся сырой: `lib/og/cover.ts` ужимает её через **sharp** до 600×600 JPEG
  и вкладывает data-URI. Без этого resvg декодировал бы оригинал (политика загрузки
  разрешает 6000×6000 / 15 МБ ≈ 144 МБ RGBA на кадр) на VPS с 1 ГБ.
- Страница при этом обязана передавать `images: null` в `pageMetadata` — иначе свой
  `openGraph` перекроет файловую картинку сегмента.
- **OG-роут публичный и сессии не видит**, поэтому повторяет гейты страницы: скрытый
  артист, черновик/архив/будущий SCHEDULED релиз, неопубликованный смартлинк, приватный
  плейлист → нейтральная карточка без данных (`ogFallbackCard`), не 404 и не утечка.
- Шрифт — `sans-serif` satori: Geist в next/font только woff2, satori его не читает.
- Длинные строки клэмпаются символами (`clampOgText`), а не CSS: satori переносит строку
  и выдавливает вордмарк за кадр.

### JSON-LD

- Компонент: `apps/web/components/json-ld.tsx` — вставляет `<script type="application/ld+json">`
- Билдеры (чистые функции, покрыты тестами) в `apps/web/lib/structured-data.ts`:
  `musicGroupJsonLd`, `musicAlbumJsonLd`, `musicRecordingJsonLd`, `musicPlaylistJsonLd`,
  `artistPostJsonLd`, `websiteJsonLd`, `artistsCatalogJsonLd`, `breadcrumbListJsonLd`,
  `faqPageJsonLd`

### Технические файлы

- `apps/web/app/robots.ts` — запрещает `/admin`, `/dashboard`, `/api`
- `apps/web/app/sitemap.ts` — артисты, релизы, треки, смартлинки и публичные
  пользовательские плейлисты (`getSitemapPlaylists`: `PUBLIC` + `kind='USER'` + есть треки;
  editorial перегенерируются ежедневно, personal персональны — оба исключены).
  Главная перечислена **без** завершающего слэша: Next для корневого canonical безусловно
  отдаёт origin (`resolve-url.js`), sitemap сверяется с ним.
- `apps/web/app/manifest.ts` — PWA-манифест

## Где код

- `apps/web/lib/site.ts` — `SITE_URL`, дефолтные мета
- `apps/web/lib/metadata.ts` — `pageMetadata` (единственный вход для метаданных страницы)
- `apps/web/lib/structured-data.ts` — JSON-LD билдеры
- `apps/web/lib/og/{card.tsx,cover.ts}` — карточка OG и ужатие обложки
- `apps/web/components/json-ld.tsx`
- `apps/web/app/layout.tsx` — `metadataBase`, title template, дефолты OG
- `apps/web/app/robots.ts`, `sitemap.ts`, `manifest.ts`
- Тесты: `apps/web/lib/__tests__/structured-data.test.ts`, `lib/og/*.test.ts`,
  `**/opengraph-image.test.tsx`

## Env-переменные

```
NEXT_PUBLIC_SITE_URL=           # https://vire.ru — базовый URL для canonical и sitemap
```

## Известные ограничения

- Sitemap генерируется при каждом запросе (нет ISR/кеша) и не ограничен по числу записей —
  может быть медленной при большой базе
- JSON-LD для треков включает duration из `track_audio.duration_ms`, но только если трек `READY`
- Canonical главной — без завершающего слэша, и это не настраивается: Next отдаёт `origin`
  для любого корневого canonical, если не включён глобальный `trailingSlash` (менять его
  ради этого нельзя — он меняет роутинг всего сайта)
