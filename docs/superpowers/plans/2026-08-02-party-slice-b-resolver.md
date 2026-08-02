# План — вечеринка, срез B: резолвер (02.08.2026)

Дизайн: `../specs/2026-08-01-party-mode-design.md`. Срез A (домен, полиморфная очередь,
`JamPlaybackState.itemId`, `JamService.addExternalItem`) уже в main.

Задача среза: превратить **любой ввод** — ссылку, текст, строку из мессенджера — в
играбельную позицию очереди. UI (поле ввода, экран вечеринки) — срез C; здесь только
домен, порты, адаптеры, кэш и роуты.

## 1. Типы и порты (`packages/core`)

`types/external.ts`:
- `ExternalTrackRef` — `{ source, externalId, externalUrl, title, artistName, coverUrl, durationSec }`
  (то, что уже принимает `addExternalItem`; вынести общий тип, `ExternalQueueEntry` в
  `jam-queue.ts` свести к нему).
- `MetadataHint` — `{ title, artistName, coverUrl, durationSec }`: кандидат из
  метаиндекса, **ещё не играбельный**.
- `TrackCandidate` — `{ kind: 'VIRE', trackId, title, artistName, coverUrl }`
  | `{ kind: 'EXTERNAL', ref }` | `{ kind: 'HINT', hint }`.

`ports/external.ts`:
- `IMetadataIndex.suggest(query, limit): Promise<MetadataHint[]>` — iTunes/Deezer.
- `IPlayableResolver.resolveUrl(url): Promise<ExternalTrackRef | null>` и
  `.searchOne(query): Promise<ExternalTrackRef | null>` — YouTube.
- `IPageMetaFetcher.fetch(url): Promise<PageMeta | null>` — oEmbed/og/JSON-LD.
- `IResolutionCache.get(key): Promise<CachedResolution | null>` / `.put(key, ref | null)`.

## 2. Чистые функции (`packages/core/src/services/external-resolve.ts`)

- `classifyInput(raw)` → `{kind:'url', url}` | `{kind:'query', text}`; ссылку внутри
  текста («слушай это https://… огонь») достаёт, эмодзи и мусорные слова чистит.
- `parseKnownUrl(url)` → `{ source, externalId }` (YouTube `watch`/`youtu.be`/`shorts`/
  `music.youtube`, SoundCloud) | `{ service, needsPageMeta: true }` (Spotify + `spotify.link`,
  Apple Music, Яндекс.Музыка, VK, Deezer, Bandcamp) | `null`. Таймкоды, `si`, `utm_*`,
  `feature` отбрасываются.
- `parseOwnUrl(url, siteHost)` → трек/релиз/смартлинк каталога.
- `normalizeUrlKey(url)` и `normalizeQueryKey(artistName, title)` — ключи кэша: lower,
  без диакритики и пунктуации, без `feat.`/`ft.`/`(prod. …)`; **суффиксы ремиксов/версий
  сохраняются** (remix ≠ оригинал).
- `scoreCatalogMatch(hint, candidates)` → лучший каталожный кандидат или `null` по порогу.

Всё выше — без сети и без Next, покрывается таблицами кейсов.

## 3. `ExternalResolveService`

`resolve(input)` — каскад, каждый шаг деградирует в следующий, тупика нет:

1. свой URL → позиция каталога;
2. известный сервис: YouTube/SoundCloud → `ExternalTrackRef` сразу (oEmbed, без ключа);
   остальные (играть нельзя) → метаданные страницы → шаг 4;
3. неизвестный URL → `IPageMetaFetcher` (oEmbed → og/twitter → JSON-LD) → шаг 4;
4. текст или добытые метаданные → матч в каталоге (`SearchService`) → кэш резолвов →
   `IPlayableResolver.searchOne` → запись в кэш.

Если ничего однозначного — вернуть **список кандидатов** для выбора, а не ошибку.
Ответ «не поддерживается» пользователь увидеть не должен.

`suggest(query)` — каталог + метаиндекс, склейка с дедупом по `normalizeQueryKey`,
каталожные всегда выше.

## 4. Кэш резолвов (миграция 0047)

`external_resolutions`: `key_kind` enum `('URL','QUERY')`, `key text`, `source`
(переиспользовать `jam_queue_source`, nullable), `external_id`, `external_url`, `title`,
`artist_name`, `cover_url`, `duration_sec`, `not_found boolean not null default false`,
`resolved_at`, `hits integer not null default 0`. `unique(key_kind, key)`.

Промахи кэшируются тоже (`not_found`) и перепроверяются не чаще раза в 30 дней — иначе
каждая неудачная попытка жжёт 100 юнитов квоты YouTube.

## 5. Адаптеры (`apps/web/lib/external/*`)

- `youtube.ts` — Data API v3: `search.list` (100 юнитов) + `videos.list` (1 юнит) за
  длительностью и `status.embeddable`; неэмбеддабельное или регионально закрытое видео
  кандидатом не считается. Без `YOUTUBE_API_KEY` — `searchOne` возвращает `null`.
- `oembed.ts` — YouTube/SoundCloud oEmbed (ключ не нужен).
- `page-meta.ts` — общий фетч страницы.
- `itunes.ts` / `deezer.ts` — метаиндекс подсказок (без ключа).
- `resolution-cache.ts` — Drizzle-репозиторий кэша.

**SSRF-дисциплина — обязательна, мы фетчим URL от пользователя** (`docs/security/owasp-top-10.md`):
только `http`/`https`; таймаут 5с через `AbortSignal.timeout`; редиректы разворачиваем
вручную, не больше 3, **каждый хоп проверяем заново**; хост резолвим и отбрасываем
loopback/private/link-local/CGNAT и их IPv6-эквиваленты (вкл. `::ffff:` mapped); тело
читаем не больше 512 КБ; content-type только `text/html`/`application/json`+`*+json`.
Любая ошибка фетча — деградация в поиск по тексту, не 500.

## 6. Роуты

- `GET /api/v1/party/suggest?q=` — подсказки (каталог + метаиндекс).
- `POST /api/v1/jam/[code]/queue/external` — резолв ввода + `JamService.addExternalItem`.
  Только участник сессии (`resolveJamIdentity`, как у остальных jam-роутов), только
  `kind='PARTY'`, лимиты очереди из среза A. Ответ: `201` с созданной позицией либо
  `200 {candidates}`, когда ввод неоднозначен.

Rate-limit (`lib/rate-limit.ts`): suggest 30/мин, external-add 10/мин — ключ по
участнику (user id / guest sessionId), **не по IP**: вечеринка сидит за одним NAT.

## 7. Тесты

- `packages/core`: парсеры ссылок таблицей кейсов (короткие ссылки, таймкоды, мусорные
  параметры, `music.youtube`, shorts), нормализация ключей (ремикс ≠ оригинал), каскад на
  фейковых портах (каталог-хит, кэш-хит, YouTube-фолбэк, всё упало → кандидаты),
  `scoreCatalogMatch`, negative-кэш не ходит в сеть повторно.
- `apps/web`: SSRF-гард (приватный IP, редирект на приватный IP, не тот content-type),
  роуты (не участник → 403, `kind='JAM'` → 400, 429 по лимиту), адаптер YouTube на
  фикстурах ответа API (вкл. `embeddable: false`).

## 8. Env

`YOUTUBE_API_KEY` — опционально; без него прямые YT/SC-ссылки работают, поиск чужого нет.
Добавить в `.env.example` и в `docs/features/party.md` (файл фичи заводится в срезе C).

## Гейты

`typecheck` (web/core/db) · `lint` · `check:routes` · `test` · `build`; миграция
прогоняется на локальной базе.

## Ограничения

- Никакого UI — поле ввода, панель добавления и экран вечеринки в срезе C.
- Никакого извлечения аудиопотока: только официальные oEmbed/embed и метаданные.
- Комментарии — только неочевидное «почему», 1–2 строки.
- `packages/core` не импортирует Next и не ходит в сеть сам — только через порты.
