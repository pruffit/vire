# План: хвосты аудита 27.07 (og:image, разметка, джем-версии)

Спека: `specs/2026-07-27-audit-tails-2-design.md`.
Порядок: C (главная сессия) параллельно с A (сабагент Sonnet), затем B (сабагент Sonnet).

## Срез A — og:image → брендовая карточка 1200×630

Новое:
- `apps/web/lib/og/cover.ts` — `fetchCoverThumb(url, size=600)`: fetch с `AbortSignal.timeout`,
  `sharp(buf).resize(size, size, { fit: 'cover' }).jpeg({ quality: 80 })` → data-URI;
  любая ошибка → `null`. Юнит-тесты на фолбэки (null-url, non-ok ответ, битые байты).
- `apps/web/lib/og/card.tsx` — `ogCard({ kind, title, subtitle, cover, size })`: 1200×630,
  обложка 400×400 слева (при `cover === null` — плитка-плейсхолдер), надзаголовок,
  заголовок, подзаголовок, вордмарк Vire. Фон/типографика — как в текущей карточке
  плейлиста (`app/(listener)/playlists/[id]/opengraph-image.tsx`), `fontFamily: 'sans-serif'`.
  Плюс `ogFallbackCard()` — нейтральная карточка без данных.
- `opengraph-image.tsx` в четырёх сегментах:
  `artists/[slug]`, `.../releases/[releaseId]`, `.../tracks/[trackId]`,
  `smartlink/[artistSlug]/[linkSlug]`. В каждом: `runtime='nodejs'`, `size`, `alt`,
  `contentType='image/png'`, `revalidate=300`, те же `CACHE_HEADERS`, что у плейлиста.

Правки:
- `app/(listener)/playlists/[id]/opengraph-image.tsx` — переводится на `ogCard` +
  `fetchCoverThumb` (мозаика ≤4 обложек сохраняется; каждая обложка через thumb).
- Четыре вызова `pageMetadata` → `images: null` (комментарий-ссылка на сегментный файл,
  как уже сделано у плейлиста).
- `apps/web/package.json` — `sharp` в `dependencies`; `pnpm install`, коммит lockfile.

Гейты приватности в OG-роутах (обязательно, роут сессии не видит):
- артист — тот же предикат, что у `assertArtistVisible` в `artists/[slug]/page.tsx`;
- релиз/трек — `isReleasePubliclyVisible` из `@vire/core`;
- смартлинк — только опубликованный;
- непрошедшее → `ogFallbackCard()`, не 404 и не данные.

Тесты: по образцу `playlists/[id]/opengraph-image.test.tsx` — на каждый сегмент кейс
«есть данные» и «скрыто → фолбэк»; юнит-тесты `fetchCoverThumb`.

## Срез B — разметка

- `lib/structured-data.ts`: в `artistPostJsonLd` `mainEntityOfPage` = якорный URL поста
  (тот же, что в `url`), не страница артиста. Поправить существующий тест.
- `lib/structured-data.ts`: новый `musicPlaylistJsonLd({ playlist, author })` —
  `MusicPlaylist` + `numTracks` + `track[]` как `MusicRecording` + `publisher`.
  Чистая функция, тесты рядом с остальными билдерами.
- `app/(listener)/playlists/[id]/page.tsx`: `<JsonLd>` только при `visibility === 'PUBLIC'`.
- `packages/db` — запрос публичных пользовательских плейлистов для sitemap:
  `visibility='PUBLIC' AND kind='USER'` + `EXISTS(playlist_tracks)`, отдаёт `id`/`updatedAt`.
  Экспорт из `@vire/db`.
- `app/sitemap.ts` — секция плейлистов внутри существующего `try` (падение БД
  по-прежнему деградирует к статике).
- `app/(listener)/page.tsx` — canonical главной со слэшем (сейчас прод отдаёт
  `https://viremusic.ru` при `https://viremusic.ru/` в sitemap).

## Срез C — джем: версионирование команд

- `lib/jam/optimistic-playback.ts`: `PendingToggle` += `fromVersion: number`;
  `resolvePending(pending, serverVersion, now, ttlMs)` снимает pending при
  `serverVersion > pending.fromVersion` либо по TTL. Сравнение по `paused` уходит.
- `app/(listener)/jam/[code]/jam-room.tsx`: `setPlaybackPending` пишет
  `fromVersion: room.playback?.version ?? 0`; вызов `resolvePending` получает
  `room.playback?.version ?? 0`.
- Тесты: своя команда долетела (version+1 → снят), чужая команда во время своего
  pending (version+1 → снят, кнопка показывает правду), no-op-команда (paused тот же,
  version вырос → снят), TTL, потерянный запрос.

## Гейты

typecheck (web/core/db), lint, check:routes, test, audit:design, build.
Затем прожарка дифа сабагентом-критиком (Sonnet) по Vire-чеклисту.

## Ship

Версия в двух `package.json`, lockfile после добавления sharp, `docs/features/*` —
обновить `seo.md`/аналог по OG-карточкам, ledger цикла, запись в `roadmap/TODO.md`.
Деплой/тег — отдельно по команде Danya.
