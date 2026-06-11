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

- Canonical URL включён в каждую страницу
- Обложки и аватары подставляются как `og:image`

### JSON-LD

- Компонент: `apps/web/components/JsonLd.tsx` — вставляет `<script type="application/ld+json">`
- Билдеры (чистые функции, покрыты тестами):
  - `buildMusicGroupLd(artist)` → `apps/web/lib/structured-data.ts`
  - `buildMusicAlbumLd(release, artist)`
  - `buildMusicRecordingLd(track, release, artist)`

### Технические файлы

- `apps/web/app/robots.ts` — запрещает `/admin`, `/dashboard`, `/api`
- `apps/web/app/sitemap.ts` — артисты + релизы из БД; `changefreq`, `priority`
- `apps/web/app/manifest.ts` — PWA-манифест

## Где код

- `apps/web/lib/site.ts` — `siteUrl()`, дефолтные мета
- `apps/web/lib/structured-data.ts` — JSON-LD билдеры
- `apps/web/components/JsonLd.tsx`
- `apps/web/app/layout.tsx` — `metadataBase`, title template, дефолты OG
- `apps/web/app/robots.ts`, `sitemap.ts`, `manifest.ts`
- Тесты: `apps/web/lib/__tests__/structured-data.test.ts`

## Env-переменные

```
NEXT_PUBLIC_SITE_URL=           # https://vire.ru — базовый URL для canonical и sitemap
```

## Известные ограничения

- Sitemap генерируется при каждом запросе (нет ISR/кеша) — может быть медленной при большой базе
- JSON-LD для треков включает duration из `track_audio.duration_ms`, но только если трек `READY`
- OG-изображения — статические обложки; динамических OG-картинок (Edge Function) нет
