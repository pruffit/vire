# SEO и структурированные данные

## Что делает

Полноценное SEO для публичных страниц: метатеги, Open Graph, Twitter Card, structured data (JSON-LD), sitemap, robots.

### Метатеги

- `metadataBase` задаётся из `NEXT_PUBLIC_SITE_URL` → `AUTH_URL` → `http://localhost:3000` (`apps/web/lib/site.ts`)
- Шаблон заголовков: `%s — VireMusic` (через `title.template` в корневом `layout.tsx`)
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
- Sitemap — индекс + шарды, потолок 10k URL на файл (протокол ограничивает 50k):
  `GET /sitemap.xml` (`app/sitemap.xml/route.ts`) отдаёт `<sitemapindex>` со ссылками на
  шарды, посчитанными на каждый запрос; `GET /sitemaps/{section}-{page}.xml` и
  `/sitemaps/static.xml` (`app/sitemaps/[shard]/route.ts`) отдают сами `<urlset>`.
  Секции: артисты, релизы, треки, смартлинки, публичные пользовательские плейлисты
  (`PUBLIC` + `kind='USER'` + есть треки; editorial/personal исключены). Шардинг —
  чистая логика в `lib/sitemap.ts` (`planShards`/`parseShardId`/`shardFileName`),
  сериализация XML — `lib/sitemap-xml.ts`; постраничные запросы — `@vire/db`
  (`packages/db/src/queries/sitemap.ts`, `count*`/`list*` с `LIMIT`/`OFFSET`,
  стабильный `ORDER BY id`). Не `generateSitemaps` — тот перечисляет шарды на этапе
  сборки, а список зависит от БД, которая на сборке образа недоступна (обе точки
  `force-dynamic`, та же причина что у `robots.ts`). БД недоступна на индексе → только
  `static.xml`; на шарде → пустой `<urlset>`, оба не 5xx. Главная в `static.xml`
  перечислена **без** завершающего слэша: Next для корневого canonical безусловно
  отдаёт origin (`resolve-url.js`), sitemap сверяется с ним. Адрес `/sitemap.xml` не
  менялся при переезде на индекс — уже подтверждён в Яндекс.Вебмастер/Search Console.
- `apps/web/app/manifest.ts` — PWA-манифест

## Где код

- `apps/web/lib/site.ts` — `SITE_URL`, дефолтные мета
- `apps/web/lib/metadata.ts` — `pageMetadata` (единственный вход для метаданных страницы)
- `apps/web/lib/structured-data.ts` — JSON-LD билдеры
- `apps/web/lib/og/{card.tsx,cover.ts}` — карточка OG и ужатие обложки
- `apps/web/components/json-ld.tsx`
- `apps/web/app/layout.tsx` — `metadataBase`, title template, дефолты OG
- `apps/web/app/robots.ts`, `manifest.ts`
- `apps/web/app/sitemap.xml/route.ts`, `apps/web/app/sitemaps/[shard]/route.ts`,
  `apps/web/lib/sitemap.ts`, `apps/web/lib/sitemap-xml.ts`, `packages/db/src/queries/sitemap.ts`
- Тесты: `apps/web/lib/__tests__/structured-data.test.ts`, `lib/og/*.test.ts`,
  `**/opengraph-image.test.tsx`

## Env-переменные

```
NEXT_PUBLIC_SITE_URL=           # https://vire.ru — базовый URL для canonical и sitemap
```

## Известные ограничения

- Sitemap-шарды генерируются при каждом запросе (нет ISR/кеша) — при очень большом каталоге
  один шард (до 10k записей) может стать медленным запросом
- JSON-LD для треков включает duration из `track_audio.duration_ms`, но только если трек `READY`
- Canonical главной — без завершающего слэша, и это не настраивается: Next отдаёт `origin`
  для любого корневого canonical, если не включён глобальный `trailingSlash` (менять его
  ради этого нельзя — он меняет роутинг всего сайта)
