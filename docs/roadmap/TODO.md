# Vire — Backlog

## Performance & SEO (из PageSpeed аудита 17.06.2026)

- [x] **H1 на главной** — добавлен `sr-only` H1 в `app/page.tsx`
- [x] **LCP мобайл** — убран `<FadeUp>` вокруг `FeaturedRelease` (opacity:0→1 задерживал LCP); `priority` и `sizes` уже были правильными
- [x] **Аналитика** — `YandexMetrika` компонент в layout, `NEXT_PUBLIC_METRIKA_ID` в env; CSP расширен для `mc.yandex.ru`
- [x] **WWW-редирект** — настроить редирект www → без www в Caddy
- [x] **Render-blocking запросы** — добавлен `display: swap` на Geist/Geist_Mono в `layout.tsx`; остальные шрифты уже были со swap
- [x] **Unused JS 190 КиБ** — источник: `hls.js` (~190 КиБ) статически импортировался в `audio-engine.ts`. Переведён на динамический `import('hls.js')` внутри `loadAndPlay` — загружается только при первом воспроизведении
- [x] **alt у изображений** — проверено: все `<img>` и `<Image>` имеют alt (пустые где декоративно)
- [x] **Контраст текста** — Impeccable не нашёл нарушений
- [x] **llms.txt** — создан `public/llms.txt` с описанием платформы для AI-краулеров
- [x] **CSP / COOP** — `'unsafe-eval'` теперь только в dev; добавлен `upgrade-insecure-requests` в prod; расширена `Permissions-Policy`; добавлен `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- [x] **Schema.org на главной** — добавлен `WebSite` JSON-LD через `websiteJsonLd()` в `app/page.tsx`
- [x] **Canonical bug** — `alternates.canonical:'/'` в root layout наследовался на все страницы (в т.ч. `/artists` → canonical = `/`). Убрано из layout, добавлен явный canonical на `/artists`.
- [x] **BreadcrumbList JSON-LD** — добавлен на `/artists` (CollectionPage + хлебные крошки), страницу артиста и страницу релиза. Новые билдеры в `lib/structured-data.ts`, покрыты тестами.
- [x] **Permissions-Policy** — убран `ambient-light-sensor` (браузер ругался «unrecognized feature»).
- [x] **Метрика SPA** — переход с `ssr:true` на `defer:true` + `onLoad`-хит. Исправлена race condition: первый pageview больше не теряется. (v1.0.56)
- [x] **Яндекс.Вебмастер** — добавлен `verification.yandex` метатег через Next.js metadata API вместо HTML-файла. Нажать «Подтвердить» на вкладке «Метатег» после деплоя v1.0.56.
- [x] **OG-изображение по умолчанию** — `app/opengraph-image.tsx` (генерируется на лету); страницы без картинки теперь наследуют fallback вместо пустого массива. (20.06.2026)
- [x] **Явный favicon** — добавлены `icons` в `layout.tsx` (favicon.ico + 192/512 png + apple-icon), чтобы Яндекс/Google подхватили иконку в выдаче.
- [x] **Canonical на главной** — добавлен `alternates.canonical:'/'` в `app/page.tsx`.
- [x] **Sitemap расширен** — добавлены треки, смартлинки и `/about`.
- [x] **Смартлинки** — добавлен canonical + `MusicAlbum` JSON-LD.
- [x] **FAQ** — `/about`: видимый блок «Частые вопросы» + `FAQPage` JSON-LD (`lib/faq.ts` — единый источник текста и разметки).
- [x] **Article** — посты артистов: `Article` JSON-LD + якоря `#post-{id}` (раньше `hasArticleSchema: no`).
- [x] **Google Search Console** — домен подтверждён через DNS-запись (свойство «Домен»), 20.06.2026. Осталось по желанию: отправить sitemap `https://viremusic.ru/sitemap.xml` + запросить индексацию ключевых страниц.
- [x] **Яндекс.Вебмастер** — домен подтверждён, 20.06.2026. (Поддержка-метатег уже на сайте, robots починен.)
- [x] **robots.txt динамический** — был статическим (на сборке без `AUTH_URL` → `Host`/`Sitemap` = `localhost:3000`), из-за чего Яндекс не подтверждал права. `force-dynamic` отдаёт реальный хост. (v1.0.58)
- [x] **LCP / кэш картинок** — персистентный том для `.next/cache/images` (переживает деплой) + `minimumCacheTTL` 24ч + `fetchpriority=high` на hero + Метрика `lazyOnload` + q60 на обложках. LCP 9.0→7.1с (лаб Slow-4G), холодный старт после деплоя устранён. (v1.0.58–1.0.62)
- [x] **React #418 (гидрация)** — даты в `release-quick-look` форматировались в локальной TZ браузера ≠ сервер (UTC). Закреплён `timeZone:UTC`/`getUTCFullYear`. (v1.0.63)
- [x] **GEO-разметка** (по аудиту 20.06.2026) — `publisher` (Organization Vire) в MusicGroup/Album/Recording, `datePublished` в MusicRecording, BreadcrumbList на страницах треков. (v1.0.64)
- [x] **h1 на /about** — «музыкана» → «музыка на» (`<br>` съедал пробел в текстовом контенте). (v1.0.64)
- [x] **Юр-страницы** — `/terms` и `/privacy` сверены с реальными провайдерами входа (только Яндекс + email; Google/TG вырезаны по 406-ФЗ), добавлена заметка о загрузке аватара в S3.
- [ ] **Проверка разметки** — прогнать через validator.schema.org и OG-дебаггер (VK/Telegram) после деплоя.
- [ ] **Контент** — уникализировать шаблонные описания релизов («Untouchable — релиз X на Vire»), заполнить `bio` у артистов без описания.
- [ ] **Запрос «vire»** — короткое конкурентное слово (vire.su, Яндекс-перевод). Топ по нему — вопрос внешних ссылок и возраста домена, не мета-тегов. Реалистичная цель: топ по «viremusic», «vire музыка», «vire площадка».

## Архитектура

- [x] **Architecture Audit** — `packages/core` чистый: только внутренние импорты + vitest в тестах. Нарушений нет.
- [x] **TECHNICAL_DEBT.md** — создан `docs/foundation/TECHNICAL_DEBT.md`: JWT без refresh, `'unsafe-inline'` в CSP, отсутствие retry в воркере, прямые инсерты play_events, один владелец артиста.

## Надёжность

- [x] **Воркер: надёжность** — retry/backoff + removeOnFail (DLQ-поведение) уже в `lib/queue.ts`. Добавлено: статус `FAILED` (миграция 0021), на финальном падении транскодинга трек PROCESSING→FAILED + письмо артисту (Brevo), `FAILED` в админ-«требует внимания» и бейджах дашборда. Идемпотентность по `track_id` подтверждена (skip если READY; FAILED не затирает READY/BLOCKED). Миграции в деплое переставлены ДО `up -d`. (v1.0.66)
- [ ] **Observability — внешний приёмник ошибок (Sentry/GlitchTip).** Отложено до
  апгрейда VPS. sentry.io блокирует РФ (403), а self-hosted GlitchTip не влезает в
  текущий 1 ГБ RAM (celery-worker прожорлив, гарантированный OOM). Sentry-SDK из кода
  **вырезан** (21.06.2026) — тяжёлые `@sentry/*` депы + OTel/drizzle-костыль не нужны
  без приёмника. Что есть сейчас: health-эндпоинт + Telegram/webhook-алерты + лог
  (см. `docs/features/monitoring.md`). Вернуться при отдельной машине/большем сервере.

## Качество

- [x] **Тесты `packages/core`** — добавлены тесты `ReleaseService.deleteRelease` (4 кейса); `makeRepo` исправлен (добавлены `delete`, `updateStatus`, `findAllByArtist`). Итого: 33 теста.
- [x] **Mobile polish (плеер/волна)** — waveform переведён на pointer-скраббер (драг пальцем/мышью + playhead, `touch-action:none`, клавиатура ←/→) в глобальном плеере (мини-бар h-1.5/фуллскрин h-9) и на странице трека (скраб только для активного трека, иначе тап = play). MiniProgressBar: драг + тач-зона 12px (видимая полоска 2px). Тап-таргеты транспорта prev/next/wave увеличены. typecheck/audit:design/тесты/сборка — зелёные. (v1.0.67)

## Этап 2

- [ ] **Фундамент прямых продаж** — purchase service в `packages/core`, вебхуки ЮКасса (верификация подписи, идемпотентность), Signed URL на FLAC. YooKassa боевая настройка `SHOP_ID`/`SECRET_KEY`.
- [ ] **Тесты Этап-2 роутов** — покрыть `purchase` и `webhooks/yookassa`.

## Фичи

- [x] **Блок хоткеев на странице /about** — секция 06 с таблицей всех клавиш в `about-content.tsx`.
- [x] **Пасхальное яйцо: Konami → попап** — Konami теперь открывает попап с кнопкой `/secret`; тройной клик по копирайту — дождь иконок по-прежнему.
- [x] **Создать страницу /secret** — сделана как `/fwqa688` (терминал-пасхалка).
- [x] **Несколько аккаунтов на одного артиста** (21.06.2026) — таблица `artist_members`
  (миграция 0024 + бэкфил владельцев в OWNER). Модель v1 — равные co-owner (OWNER
  неудаляем, права по ролям не разводим). Контроль доступа к дашборду переведён с
  `artist_profiles.user_id` на membership (`findByUserId`/`findAllByUserId`/
  `findByIdForUser` джойнят `artist_members`). Добавляет админ в `/admin/artists`
  (кнопка «Участники» → поповер: список + add по email + remove). `createArtistForUser`
  пишет OWNER-членство. Доки — `docs/features/multi-artist.md`.
- [x] **Актуализировать дорожную карту** (21.06.2026) — CLAUDE.md «Текущий статус»
  дополнен смартлинками, пресейвами (Фаза A+B), explicit-бейджем, каталогом релизов,
  плейлистами на главной; счётчик тестов 125→200; «Что делать дальше» указывает на
  TODO.md. concept.md уже содержит «Что вышло по факту» по Этапу 1; этапы 2–4 —
  forward-looking, переформирование не требуется (фундамент в них упирается).
- [x] **Индексация в поисковиках** — перенесено в блок Performance & SEO выше (детали там).
- [x] **Пресейвы — Фаза B (смартлинки ↔ Vire + внешние платформы)** — Фаза A + B
  готовы (21.06.2026):
  - [x] Привязка смартлинка к релизу Vire: `release_id` FK в `smart_links` (миграция
    0023, `onDelete: set null`); лендинг авто-подхватывает обложку/название/дату релиза
    в пустые поля.
  - [x] Первой кнопкой на смартлинке — «Слушать на Vire» (вышел) / «Пресейв на Vire»
    (SCHEDULED с будущей датой → страница отсчёта с нативным пресейвом Фазы A). Лого `Logo`.
  - [x] Внешние пресейв/follow-ссылки артиста (Spotify/Apple/Яндекс) — обычные ссылки
    площадок смартлинка (уже поддержано), без OAuth.
  - [x] Редактор смартлинка: дропдаун выбора релиза (любой статус, проверка владения
    в API POST/PATCH).
  - [x] Кнопка пресейва инлайн в секции «Скоро выйдет» на странице артиста
    (`upcoming-presave-button.tsx`; батч-состояние `getPresaveStates`).
- [x] **Explicit-бейдж (E) на карточках релизов** (21.06.2026). Агрегат `hasExplicit`
  (коррелированный EXISTS по `tracks.is_explicit`) добавлен в `releaseCardColumns`
  (`discovery.ts` → `DiscoveryRelease`: главная/каталог/upcoming) и в `getFeed` (`feed.ts`
  → лента). Для страницы артиста (доменный `Release` без explicit-данных) — хелпер
  `getExplicitReleaseIds(ids)` одним запросом. Рендер: `ReleaseQuickLook` (бейдж у названия
  карточки) и `FeaturedRelease` (у героя). Покрывает главную, ленту, профиль артиста,
  каталог `/releases`. Смартлинки — отдельно в блоке пресейвов Фаза B.

## Долг переработки плеера/рекомендаций (v1.8.0) — закрыт

- [x] **Унификация трек-строк** — общий `apps/web/components/track-row.tsx` (`TrackRow`);
  `track-list.tsx`, `liked-track-row.tsx`, `playlist-track-row.tsx`, `purchased-track-row.tsx`
  переведены на тонкие обёртки над ним.
- [x] **Сирота-sid волны** — `controls.startWave` пробует свежий кандидат-sid, но
  коммитит его в `sessionStorage` только при успешном фетче (`tracks.length>0`);
  неудачный старт не оставляет играющую старую волну без своего sid.
- [x] **`originalQueue` персистится без среза** (pre-existing B1) — режется тем же
  оконным алгоритмом (`sliceWindowAroundIndex`), что и `queue`, по позиции текущего
  трека в исходном порядке (`sliceOriginalQueueForPersist`).
- [x] **Кэш `getTasteProfile`** — TTL-кэш 60с, потолок 500 записей (`createTtlCache`
  в `packages/core/src/util/ttl-cache.ts`, инъектируемое время); `clearTasteProfileCache()`
  для тестов; сигнатура и вызывающие не менялись.
- [x] **Кнопка очереди мини-бара скрыта `<sm`** — добавлена `MobileQueueButton`
  (`sm:hidden`) в мини-баре; очередь теперь доступна без перехода в фуллскрин.
- [x] **Live-очередь без потолка в памяти** — `capLiveQueue` (`LIVE_QUEUE_LIMIT=300`,
  `apps/web/lib/player/queue.ts`) режет рантайм-`queue` и `originalQueue` окном вокруг
  текущего трека при росте волны.
- [x] **Restored показывает 0:00 до первого play** — `duration` теперь персистится;
  `attachAndPlay` при резюме (`isResume`) не обнуляет его — после F5 сразу видна
  длительность восстановленного трека.

## Остаточный долг (финальное ревью v1.8.0)

- [x] **Кадр 0:00 текущего времени в resume-окне после F5** — `hasAudio:true` при
  `isResume` выставляется в колбэке `MANIFEST_PARSED`/native-`canPlayType` **после**
  `audio.currentTime = seekTo` (обе ветки), не раньше; fallback-ветку `isLoading` не
  трогали (регрессировала бы buffer-stalls). (пачка B)
- [x] **Single-flight на конкурентные промахи TTL-кэша вкуса** — `ttl-cache.ts` держит
  `inFlight: Map<K, Promise<V>>`, параллельные промахи на ключ делят один промис
  (снимается на успехе и ошибке; синхронный throw в `load()` оборачивается в реджект). (пачка D)
- [x] **Собственные typecheck-скрипты для `packages/core` и `packages/db`** — `tsc --noEmit`
  в обоих `package.json`; CI-таск `turbo run typecheck` без scope-фильтра фанаутит на них сам. (пачка D)
- [x] **a11y-мелочи `TrackRow`** — `aria-label` клика переиспользует `playAriaLabel`
  (переключается «Воспроизвести»/«Пауза»); в `playlist-track-row.tsx` длительность за
  guard'ом `typeof durationSec === 'number' && durationSec > 0` — «0» больше не рендерится. (пачка B)

## Аудит перед стабильной версией (10.07.2026)

Закрыто в v1.17.1 (безопасность/утечки/перф): утечка черновиков через
`GET /api/v1/releases/[id]` и страницу трека (единый `isReleasePubliclyVisible`
в `packages/core`), rate limit на `moments` и вебхук ЮKassa, анти-энумерация в
логине (bcrypt по фиктивному хэшу), безлимитные dedup-мапы алертов
(`createThrottleGate`), N+1 в `findAllByArtist`, ререндеры всех трек-листов на
смену трека (`useTrackPlayState`), поллинг `LiveListeners` в скрытой вкладке,
рост карты позиций в `ScrollRestoration`.

Осталось (по убыванию ценности):

- [x] **Покрывающий индекс `play_events(track_id, started_at) INCLUDE (duration_played_sec)`**
  для `qualityScore` в `getWaveTracks` — миграция `0033`, заменил обычный
  `play_events_track_started_idx` (0032) целиком (не добавлен рядом — самая горячая
  на вставку таблица, покрывающий обслуживает те же чтения + index-only для
  qualityScore). `schema/analytics.ts` больше не объявляет обычный композит
  декларативно (drizzle-orm 0.45.2 не умеет `INCLUDE` в схеме) — только в кастомном
  SQL миграции.
  **Замер (10.07.2026, синтетика 50 артистов / 300 релизов / 1500 треков / 220.5k
  `play_events` за 60 дней, режим похожести с заданным `currentTrackId`):**
  qualityScore-подзапрос по всем видимым кандидатам (та же форма, что в
  `getWaveTracks`) — `Bitmap Heap Scan … loops=1500` (`Heap Blocks: exact=220500`,
  1133.7мс) → `Index Only Scan using play_events_track_started_covering_idx …
  loops=1500`, **`Heap Fetches: 0`** (172.0мс) — 6.6× на самом подзапросе.
  Полный `getWaveTracks` (медиана 10 прогонов): **5818мс → 302мс (19.3×)**.
  Вывод: в отличие от обычного композита (см. предыдущий замер ниже) — INCLUDE
  закрывает задачу: qualityScore перестал ходить в heap. Волновой скоринг больше
  не открытый пункт бэклога перфа по этому направлению; top-N/материализованные
  агрегаты не нужны, если профиль нагрузки останется близким к этому синтетическому.
  Предыдущий замер того же дня (без INCLUDE): композитный индекс
  `play_events(track_id, started_at)` волну не ускорял — медиана 23.1с → 23.0с
  (1.005×), т.к. `qualityScore` усредняет `duration_played_sec`, колонку вне
  индекса → `Seq Scan … loops=1500`. Тот же индекс на подзапросе популярности
  (только `COUNT`) давал 21.9с → 0.49с (44.8×) — тот замер и привёл к идее INCLUDE.
- [x] **Композитный индекс `play_events(track_id, started_at)`** — заменил
  `play_events_track_id_idx` (не добавлен рядом: композит служит левым префиксом,
  а `play_events` — самая горячая на вставку таблица). Миграция `0032`. (v1.17.1)
- [x] **GIN + pg_trgm на `artist_profiles.name`/`releases.title`/`tracks.title`** —
  миграция `0032`. На текущем объёме планировщик всё ещё выбирает seq scan (при
  `enable_seqscan=off` индексы подхватываются через `Bitmap Index Scan`) — это
  страховка на рост каталога, а не сиюминутный выигрыш. (v1.17.1)
- [x] **Тяжёлые счётчики в `/admin/artists`** (`listArtistsAdmin`, `admin.ts`) — 4
  коррелированных подзапроса × 50 строк сведены к 4 предагрегированным `LEFT JOIN`
  (follows/releases/tracks/play_events группируются по `artist_profile_id` ОДИН раз,
  затем хеш-джойнятся со страницей артистов). Выдача сверена построчно со старой
  версией на синтетике (50 артистов/300 релизов/1500 треков) — 0 расхождений по
  followers/releases/tracks/plays30d. На этом объёме (N=50) сам рефактор не быстрее
  (avg 76мс старая версия vs 110мс новая) — выигрыш архитектурный: 4 прохода вместо
  N, должен обгонять с ростом числа артистов, а не на текущем малом каталоге.
- [x] **`useOptimisticToggle`** — общий хук (`apps/web/lib/use-optimistic-toggle.ts`)
  поверх оживлённого `@vire/api-client`; 5 дублей переведены на него, разъехавшаяся
  обработка сетевого сбоя сведена к одной ветке (лайк плейлиста при этом перестал
  падать молча). Остальные ~57 сырых `fetch` — по мере надобности.
  Фича: `docs/features/api-client.md`. (v1.17.1)
- [x] **`player-like-button.tsx` — шестой дубль тоггла без guard'а** — лайк из плеера
  и трек-листов ходит через zustand-стор (`store/likes.ts`); под общий хук не подошёл
  (это стор, не компонент). Добавлен guard от повторного клика: `toggle(trackId)` в сторе
  с module-level `Set` in-flight трек-id (синхронное чтение), сеть — через `likeTrack` из
  `@vire/api-client`. Два быстрых клика больше не гонят POST/DELETE в разнобой. +5 тестов
  (`store/likes.test.ts`).
- [x] **Sitemap N+1** — `listTrackIdsByReleaseIds` в `@vire/db` (один `inArray`,
  сгруппировано в Map) заменил последовательный `await` по релизам внутри артиста
  (`app/sitemap.ts`): вместо N+1 по каталогу — фиксированное число запросов на заход краулера.
- [ ] **CSP `'unsafe-inline'` в `script-src` на проде** (`next.config.ts:46`) — **исследовано,
  отложено с находками** (см. `docs/foundation/TECHNICAL_DEBT.md`). Nonce-путь реализован
  и откачен: (1) сырой инлайн-скрипт reduce-motion (`layout.tsx:100`, не авторский next-script)
  не получает nonce автоматически → в проде без `unsafe-inline` он **блокируется**; dev это
  маскировал (там `unsafe-inline` остаётся). Ручное протягивание nonce из заголовка в каждый
  такой скрипт — постоянный источник ошибок. (2) Per-request nonce переводит всю площадку на
  **dynamic rendering** (Next opt-out статики/ISR) — регрессия LCP публичных SEO-страниц,
  недопустимая в пассе стабилизации. Hash-only не годится: инлайн RSC-стриминг Next несёт
  per-request данные → хэш не фиксируется. Возврат — отдельной задачей, не под стабильную версию.
- [x] **Guest-пресейв без double opt-in** (`presave/route.ts`) — продуктовое решение:
  не double opt-in (режет конверсию, не убирает письмо), а IP-лимит (20/час, отдельно
  от email-лимита) на гостевой POST + ссылка «отписаться» в письме «вышло»
  (HMAC-подписанный email, без таблицы токенов — `lib/presave-unsubscribe.ts`,
  зеркало в воркере). Подробнее — `docs/features/presaves.md`.
- [x] **`sessionId` присутствия не подписан** (`lib/presence.ts`) — HMAC-подпись
  (`lib/session-signing.ts`, секрет `LINK_SIGNING_SECRET`/`AUTH_SECRET`). Id выдаёт
  только сервер (`POST /api/v1/session`), presence/listening/play-роуты проверяют
  подпись и отбрасывают неподписанный вход. Без секрета в env — деградация к прежнему
  (непроверяемому) поведению, косметика как принятый риск. Подробнее —
  `docs/features/live-presence.md`.
- [x] **XHR батч-загрузки абортится при анмаунте** (`batch-track-upload.tsx`) — `XMLHttpRequest`
  складываются в ref, cleanup-эффект вызывает `abort()` при размонтировании: уход со страницы
  в процессе аплоада больше не оставляет висящие запросы.

## Отложенное из критики главной (13.07.2026)

- [ ] **CoverFan fallback на тонком каталоге** — веер накладывающихся обложек
  вырождается в веер из одинаковых карточек, если релизов мало.
- [ ] **Skeleton-состояния секций главной** — секции ниже сгиба (rails,
  подборки) грузятся без плейсхолдера, дают дёрганый layout shift.
- [ ] **«Играть следующим»/«В очередь» с карточек хаба** — power-user действие
  прямо с карточки релиза/трека на главной, без захода в трек.
- [ ] **Ревизия числа чипов «Потока»** под hero — сейчас 11 видимых + 2 CTA,
  три конкурирующие точки входа в один и тот же флоу.
- [ ] **Компонентный тест `Announcements`** — маунт → показ авто-анонса →
  закрытие → второй из очереди не появляется в этом же маунте.

## Фидбек пользователей

- [x] **Баг: показать пароль при регистрации** — кнопка не работала (контролируемый input с `value=` блокировал смену `type`). Фикс: убрать `value`, оставить `onChange`. (21.06.2026, 021002masha@mail.ru)
- [x] **Идея: Ctrl+F для поиска** — добавлен как алиас Ctrl+K в command-palette.tsx. (21.06.2026, samarskipanki@gmail.com)

## Skills

- [x] **Project-скиллы под стек Vire** (21.06.2026). Готовых плагинов по этим темам
  в подключённых маркетплейсах (claude-plugins-official 2185 шт. + ponytail) нет —
  каталог почти весь вендорный. Вместо них заскаффолжены 4 локальных скилла в
  `.claude/skills/` с привязкой к реальному коду и конвенциям из CLAUDE.md:
  `vire-architecture` (слои handler→service→repo, Result, DI, zod),
  `vire-media` (FFmpeg/HLS-конвейер, waveform, vault/stream), `vire-testing`
  (Vitest/TDD по слоям, регресс на инциденты, гейты), `vire-queues` (BullMQ
  producer/consumer, идемпотентность/jobId, грабли Drizzle). Едут в репозитории.
