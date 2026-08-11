# VireMusic — Backlog

## Performance & SEO (из PageSpeed аудита 17.06.2026)

- [x] **Soft-404: `notFound()` отдаёт 200** (найдено 28.07.2026 смоуком прод-артефакта,
  починено 01.08.2026). Гипотеза подтвердилась: `proxy.ts` ни при чём — причина в
  file-convention `loading.tsx`. Любой `loading.tsx`-предок (не только в своём сегменте —
  ЛЮБОЙ выше по дереву) оборачивает всё поддерево в Suspense; Next флашит шелл со статусом
  200 до того, как вложенный `notFound()` успевает сработать, и статус необратим. Виноваты
  три файла: (1) `app/loading.tsx` (истинный корень) — скелетон предназначался только
  главной, но заворачивал ВЕСЬ сайт (главная переехала в приватную группу
  `app/(listener)/(home)/`, скелетон переехал туда же); (2) `(listener)/artists/loading.tsx`
  — тем же паттерном заворачивал `/artists/[slug]` (каталог переехал в
  `artists/(catalog)/`); (3) `artists/[slug]/loading.tsx` +
  `releases/[releaseId]/loading.tsx` + `tracks/[trackId]/loading.tsx` — удалены: они
  ЕДИНСТВЕННЫЕ доступные точки эффективно исключают корректный статус для вложенных
  артист→релиз→трек (хост-приём «проверка в layout.tsx выше loading.tsx» не спасает —
  loading.tsx родителя всё равно заворачивает всех потомков ниже, включая их layout).
  Добавлен `artists/[slug]/layout.tsx` + `artist-guard.ts` — гейт «артист существует и
  виден» выше Suspense (быстрый 404 на несуществующий slug без захода в release/track
  сервисы). **Остаточный пробел (осознанно не тронут):** `dashboard/loading.tsx` — те же
  условия для `dashboard/links/[id]` и `dashboard/releases/[id]`, но это авторизованная
  зона артиста вне индекса поисковика — SEO-риска нет, оставлено как принятый долг.
  Регресс — статический инвариант `app/__tests__/soft-404.test.ts`: ни один
  `page.tsx`/`layout.tsx` с `notFound()` не должен стоять под `loading.tsx`-предком
  (с явным исключением `dashboard/**`).
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
- [x] **GEO-разметка** (по аудиту 20.06.2026) — `publisher` (Organization VireMusic) в MusicGroup/Album/Recording, `datePublished` в MusicRecording, BreadcrumbList на страницах треков. (v1.0.64)
- [x] **h1 на /about** — «музыкана» → «музыка на» (`<br>` съедал пробел в текстовом контенте). (v1.0.64)
- [x] **Юр-страницы** — `/terms` и `/privacy` сверены с реальными провайдерами входа (только Яндекс + email; Google/TG вырезаны по 406-ФЗ), добавлена заметка о загрузке аватара в S3.
- [x] **Проверка разметки** (27.07.2026) — аудит JSON-LD и OG/Twitter по живому проду
  (8 страниц: главная, `/artists`, `/releases`, `/about`, артист, релиз, трек, смартлинк).
  JSON-LD везде валиден, `BreadcrumbList` непрерывен, даты ISO, `canonical` совпадает с URL.
  Найдено и **починено**: (1) `/artists`, `/releases`, `/about` шарились карточкой главной —
  свой `openGraph` наследовал `url:'/'` из root layout; (2) на артисте/релизе/треке
  `twitter:title`/`description` оставались общесайтовыми при правильной картинке;
  (3) `og:title` не совпадал с `<title>` (шаблон `%s — VireMusic` к OG не применяется);
  (4) `og:image` без `width`/`height`/`alt`; (5) `position` на `MusicRecording` — вне
  словаря schema.org. Всё сведено в хелпер `apps/web/lib/metadata.ts` (дефолты
  siteName/locale/картинка — из `lib/site.ts`, общего с root layout).
  ⚠️ Важное свойство Next: метаданные мёржатся **поверхностно** — свой `openGraph`
  заменяет родительский целиком, включая привязку файловой `opengraph-image.tsx`.
- [x] **Тяжёлые og:image** (27.07.2026) — артист/релиз/трек/смартлинк переведены на
  файловую конвенцию `opengraph-image.tsx` с брендовой карточкой 1200×630; обложка
  ужимается через sharp (`lib/og/cover.ts`), карточка общая с плейлистом (`lib/og/card.tsx`).
  Смартлинк **11.9 МБ → 498 КБ**, релиз 2.1 МБ → 454 КБ, трек → 446 КБ, артист → 293 КБ;
  `og:image:width/height` перестали врать. OG-роуты повторяют гейты приватности страницы
  (скрытый артист/черновик/приватный плейлист → нейтральная карточка). Детали —
  `docs/features/seo.md`.
- [x] **Мелочи разметки (аудит 27.07.2026)** — `mainEntityOfPage` у постов-`Article`
  указывает на якорь поста, а не на общую страницу артиста; публичные пользовательские
  плейлисты получили `MusicPlaylist`-разметку и попали в sitemap (`getSitemapPlaylists`:
  `PUBLIC` + `kind='USER'` + есть треки; editorial/personal исключены осознанно).
  **Canonical главной со слэшем — won't-fix:** Next безусловно отдаёт `origin` для любого
  корневого canonical (`resolve-url.js:109`), обойти можно только глобальным
  `trailingSlash`, меняющим роутинг всего сайта. Расхождение устранено с другой стороны —
  главная в sitemap теперь тоже без слэша.
- [x] **Контент** — ✅ фолбэк meta-description релиза/трека уникализирован (чистый хелпер
  `apps/web/lib/meta-descriptions.ts`: варьирует текст по типу релиза/году/кол-ву треков,
  заданное `release.description` по-прежнему приоритетнее). ✅ (03.08.2026) `bio` заполнены
  у всех активных артистов: трое пустых (`yicyken`, `solenoid`, `molten-noir`) получили
  черновики — только проверяемые факты (город и формат от Danya + релизы из каталога),
  без сочинённых описаний звука. Дальше текст ведут сами артисты через дашборд.
- [x] **Смартлинк подтягивал данные неопубликованного релиза** (ревью 27.07.2026,
  закрыто 28.07.2026) — гейт статуса стоял только на CTA-кнопке, а `display`
  (`title`/`coverUrl`/`releaseDate`) дополнялся релизом без проверки: при пустых полях
  лендинга и `release_id` на DRAFT/ARCHIVED название и обложка черновика уходили на
  страницу и в OG-карточку. Оба потребителя переведены на чистую
  `resolveSmartLinkDisplay` (`packages/core/src/music/marketing/smart-link-display.ts`) — один гейт
  на CTA и на подстановку полей, поверх существующих `isReleasePubliclyVisible`/
  `isCountdownVisible`. SCHEDULED с будущей датой остаётся видимым (путь пресейва),
  SCHEDULED без даты трактуется как черновик.
- [x] **Скрытый артист по прямой ссылке — утечки нет** (перепроверено 28.07.2026) —
  пункт был заведён по ошибке. `DrizzleArtistRepository.findBySlug`
  (`packages/db/src/repositories/artist.ts:15`) фильтрует `isActive=true` с первого
  коммита сервисного слоя (`9dbfe22`), а страница артиста, релиз, трек, смартлинк и все
  четыре OG-роута резолвят артиста только через `ArtistService.getBySlug` → скрытый
  артист даёт 404 / нейтральную карточку. `assertArtistVisible` гейтит **другое** —
  артиста без опубликованных треков. Остаточный (осознанно не закрытый) край: трек
  скрытого артиста, уже лежащий в чужом плейлисте или лайках, оттуда не исчезает.
- [x] **Sitemap без потолка** — `/sitemap.xml` стал индексом на шарды по ≤10k URL
  (`app/sitemaps/[shard]/route.ts`), request-time вместо `generateSitemaps` (см. `docs/features/seo.md`).
- [ ] **Запрос «vire»** — короткое конкурентное слово (vire.su, Яндекс-перевод). Топ по нему — вопрос внешних ссылок и возраста домена, не мета-тегов. Реалистичная цель: топ по «viremusic», «vire музыка», «vire площадка».

## Архитектура

- [x] **Architecture Audit** — `packages/core` чистый: только внутренние импорты + vitest в тестах. Нарушений нет.
- [x] **TECHNICAL_DEBT.md** — создан `docs/foundation/TECHNICAL_DEBT.md`: JWT без refresh, `'unsafe-inline'` в CSP, отсутствие retry в воркере, прямые инсерты play_events, один владелец артиста.
- [ ] **`/artists` упирается в 200 артистов** — страница берёт весь каталог одним запросом
  (клиентский фильтр по жанрам работает по всему списку), потолок сервиса 200. При росте сверх
  него счётчик показывает `200+`, хвост каталога и жанры отрезанных артистов не видны. Лечится
  серверной фильтрацией/подгрузкой — `GET /api/v1/artists` с `limit`/`offset` для этого готов.
- [ ] **`GET /api/v1/artists/[slug]` мимо гейта видимости** — ресурсный роут отдаёт профиль
  по слагу без проверки «пустой артист скрыт с витрины» (`ArtistService.getBySlug` правил
  видимости не знает). Страница и экранный `/api/v1/artists/[slug]/page` (шаг 2.1) закрыты,
  этот — нет. Найдено при ревью шага 2.2; чинить вместе с переводом ресурсных роутов на
  read-сервисы (волна 2), отдельной правкой смысла мало.

## Надёжность

- [x] **JWT-refresh роли/identity** (17.07.2026, v1.23.2) — роль/имя/аватар перечитываются из БД
  в `jwt`-callback (`auth.ts`) не чаще раза в 5 мин (`JWT_ROLE_REFRESH_MS`), **только в Node**
  (`isNodeRuntime` — edge-middleware `proxy.ts` postgres.js недоступен, токену доверяем). Чистый
  хелпер `lib/jwt-refresh.ts` (`applyJwt`/`shouldRefreshRole`), 13 тестов; анти-storm: `syncedAt`
  двигается при любой попытке (успех/удалён/ошибка) → просадка БД не даёт рефетч на каждый запрос.
  Смена роли доезжает без релогина, статика остаётся статикой. Детали — `TECHNICAL_DEBT.md`.
- [x] **rate-limit на `DELETE /api/v1/tracks/[id]/like`** (17.07.2026) — зеркало POST (`unlike:${uid}`,
  60/60); асимметрия с `playlists/like` устранена. Идемпотентные DELETE-асимметрии (unlike без
  exists-check) — намеренны (корректный REST), не баг.
- [x] **Воркер: надёжность** — retry/backoff + removeOnFail (DLQ-поведение) уже в `lib/queue.ts`. Добавлено: статус `FAILED` (миграция 0021), на финальном падении транскодинга трек PROCESSING→FAILED + письмо артисту (Brevo), `FAILED` в админ-«требует внимания» и бейджах дашборда. Идемпотентность по `track_id` подтверждена (skip если READY; FAILED не затирает READY/BLOCKED). Миграции в деплое переставлены ДО `up -d`. (v1.0.66)
- [ ] **Observability — внешний приёмник ошибок (Sentry/GlitchTip).** Отложено до
  апгрейда VPS. sentry.io блокирует РФ (403), а self-hosted GlitchTip не влезает в
  текущий 1 ГБ RAM (celery-worker прожорлив, гарантированный OOM). Sentry-SDK из кода
  **вырезан** (21.06.2026) — тяжёлые `@sentry/*` депы + OTel/drizzle-костыль не нужны
  без приёмника. Что есть сейчас: health-эндпоинт + Telegram/webhook-алерты + структурный
  JSON-лог (`lib/observability.ts`) (см. `docs/features/monitoring.md`). Вместе с приёмником
  возвращается и `request_id`-корреляция (сейчас без агрегатора трейсов — низкая ценность,
  см. `TECHNICAL_DEBT.md` → Observability). Вернуться при отдельной машине/большем сервере.

## Качество

- [x] **Джем: optimistic pause/play у хоста** (27.07.2026) — чистый `lib/jam/optimistic-playback.ts`
  (`effectivePaused`/`resolvePending`, TTL 5с); команда и визуал считаются от оптимистичного
  состояния, `usePlaybackSync` по-прежнему получает серверный `room.playback` (звук не двигаем).
  Снятие pending: подтверждение по SSE (адаптация state в рендере), TTL-таймер, ошибка запроса
  (только свой pending — сравнение по идентичности).
- [x] **Тест ретрай-таймера бутстрапа E2EE** (27.07.2026) — кейсы с `vi.useFakeTimers()` +
  `advanceTimersByTimeAsync`: ошибка → +15с → повторный заход → `ready`; размонтирование
  до срабатывания таймера → повтора нет.
- [x] **Джем: pending не различает свою команду и чужую** (27.07.2026) — `PendingToggle`
  запоминает `fromVersion`, `resolvePending` снимает pending по росту `version` серверного
  playback (любая долетевшая мутация — своя или чужая), а не по совпадению `paused`.
  Заодно закрылся no-op-кейс: пауза поверх паузы двигает `version`, но не `paused`.
- [x] **Тесты `packages/core`** — добавлены тесты `ReleaseService.deleteRelease` (4 кейса); `makeRepo` исправлен (добавлены `delete`, `updateStatus`, `findAllByArtist`). Итого: 33 теста.
- [x] **Mobile polish (плеер/волна)** — waveform переведён на pointer-скраббер (драг пальцем/мышью + playhead, `touch-action:none`, клавиатура ←/→) в глобальном плеере (мини-бар h-1.5/фуллскрин h-9) и на странице трека (скраб только для активного трека, иначе тап = play). MiniProgressBar: драг + тач-зона 12px (видимая полоска 2px). Тап-таргеты транспорта prev/next/wave увеличены. typecheck/audit:design/тесты/сборка — зелёные. (v1.0.67)

## Мобайл-фёрст база (заказ Дани 21.07.2026)

- [x] **Мобайл-фёрст UX/UI-база для всего сайта** — программа завершена, в проде
  с v1.33.0 (все срезы + бэклог закрыты, см. `project-vire-mobile-first.md`).
  Контекст: app-shell остаётся (документного скролла НЕ будет — решение 21.07.2026),
  браузерный хром на мобилке не спрятать (Яндекс Браузер не умеет PWA/WebAPK) →
  компенсируем качеством UX в минимальном вьюпорте; эта база потом ляжет в нативные/
  обёрточные приложения. Скоуп:
  - Аудит всех ключевых экранов в узком вьюпорте: главная, поиск, артист/релиз/трек,
    медиатека, плейлисты/любимые, плеер (мини/фуллскрин), джем, сообщения, друзья,
    профиль, дашборд артиста.
  - Единая система мобильных паттернов: навигация (таб-бар 4 пункта — уже сделано),
    bottom-sheet вместо поповеров, тач-таргеты ≥44px, компактные шапки без переносов,
    плотность списков, поведение плеера, минимум вертикального мусора (низ съедают
    плеер + таб-бар).
  - Планка — Impeccable по умолчанию («ахуительный UX/UI»); `audit:design` как гейт.
  - Память: `project-vire-mobile-strategy.md`.
- [x] **Хвост клэмпа оверлеев** (27.07.2026) — закрыт **не** переводом на примитив `Popover`
  (он заточен под action-меню: свои базовые классы панели, обёртка `relative shrink-0`,
  триггер render-prop'ом), а подключением того же общего механизма напрямую:
  `color-field.tsx`, `date-field.tsx`, `add-to-playlist-button.tsx` (десктоп-ветка) —
  через хук `useViewportClampX`; `members-manager.tsx` — через чистую `clampPanelX`
  прямо в `place()`, чтобы позиция и клэмп считались одним обработчиком (там панель в
  портале с `fixed` и своим слушателем scroll/resize — два независимых расчёта давали
  рассинхрон).

## Этап 2

- [ ] **Фундамент прямых продаж** — purchase service в `packages/core`, вебхуки ЮКасса (верификация подписи, идемпотентность), Signed URL на FLAC. YooKassa боевая настройка `SHOP_ID`/`SECRET_KEY`.
- [x] **Тесты Этап-2 роутов** — покрыты в 1-J: `tracks/[id]/purchase/route.test.ts`
  (8 кейсов), `webhooks/yookassa/route.test.ts` (11, вкл. анти-forge через re-fetch),
  `packages/core` `purchase.test.ts` (18). Доведено 18.07.2026: покрыты последние
  непротестированные звенья пути покупки — адаптеры `lib/yookassa.ts` (basic-auth,
  Idempotency-Key, форма тела, throw на не-2xx) и `lib/payment-gateway.ts` (маппинг
  confirmation_url, `catch → null` в getPayment).

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
- [x] **Пресейвы — Фаза B (смартлинки ↔ VireMusic + внешние платформы)** — Фаза A + B
  готовы (21.06.2026):
  - [x] Привязка смартлинка к релизу VireMusic: `release_id` FK в `smart_links` (миграция
    0023, `onDelete: set null`); лендинг авто-подхватывает обложку/название/дату релиза
    в пустые поля.
  - [x] Первой кнопкой на смартлинке — «Слушать на VireMusic» (вышел) / «Пресейв на VireMusic»
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
  в `packages/core/src/platform/util/ttl-cache.ts`, инъектируемое время); `clearTasteProfileCache()`
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

## Отложенное из критики главной (13.07.2026) — закрыто 14.07.2026

Спека/план: `docs/superpowers/{specs,plans}/2026-07-13-homepage-deferred-batch*`.

- [x] **CoverFan fallback на тонком каталоге** — дедуп обложек и в выдаче
  `getEditorialPlaylists`, и в `buildFan` (после дедупа 1 уникальная → плоская
  карточка вместо веера клонов); `buildFan` экспортирован и покрыт тестами.
- [x] **Skeleton-состояния секций главной** — главная переведена на RSC-стриминг:
  блокирующая часть только hero + «Поток», секции — async-компоненты
  (`home-sections.tsx`) за `Suspense`, общие фетчи через React `cache()`.
  Статичные скелетоны (без анимаций — анти-джиттер) у стабильно непустых секций,
  размеры совпадают с контентом; условно-пустые — `fallback={null}`.
- [x] **«Играть следующим»/«В очередь» с карточек хаба** — `controls.enqueue` +
  чистая `insertIntoQueue` (тесты), кебаб `TrackQueueMenu` на строках треков
  главной и в peek-шите релиза (там `drop="down"` против клипа overflow-hidden);
  тач-таргет 44px, авто-флип вниз у строк под шапкой (`docs/features/player.md`).
- [x] **Ревизия числа чипов «Потока»** — один смешанный ряд топ-8 mood+genre по
  count (`topWaveChips`, тесты) вместо двух полных рядов; совпадающие лейблы
  («Эмбиент» mood против genre) дедуплицируются. Итог: CTA + один ряд.
  **Регрессия cap=8 закрыта 14.07.2026** (`2026-07-14-flow-tags-and-fluid-rails`):
  cap убран (`waveChips`), редкие теги достижимы через шит «Все теги» с поиском
  и группировкой каталога; ленты главной переведены на fluid-ширину
  (`flex-[1_0_basis] max-w-*`) — `docs/features/wave.md`.
- [x] **Компонентный тест `Announcements`** — 4 кейса (jsdom + testing-library):
  авто-показ, «один за маунт», очередь на следующий маунт, ручное открытие без
  seen-флага.

Техдолг вдогонку (из ревью пачки): `track-queue-menu.tsx` — третья копия
поповер-паттерна (`track-share.tsx` + позиционные меню). ✅ **Закрыт 17.07.2026**
(пачка «обложки+шеринг плейлистов»): общий примитив `components/popover.tsx`
(outside-click + Escape + AnimatePresence + авто-флип + `drop="down"`),
`track-share.tsx` и `track-queue-menu.tsx` переведены на него, `PlaylistShare`
сразу построен на примитиве.

## Фидбек пользователей

- [x] **Баг: показать пароль при регистрации** — кнопка не работала (контролируемый input с `value=` блокировал смену `type`). Фикс: убрать `value`, оставить `onChange`. (21.06.2026, 021002masha@mail.ru)
- [x] **Идея: Ctrl+F для поиска** — добавлен как алиас Ctrl+K в command-palette.tsx. (21.06.2026, samarskipanki@gmail.com)

## Skills

- [x] **Project-скиллы под стек VireMusic** (21.06.2026). Готовых плагинов по этим темам
  в подключённых маркетплейсах (claude-plugins-official 2185 шт. + ponytail) нет —
  каталог почти весь вендорный. Вместо них заскаффолжены 4 локальных скилла в
  `.claude/skills/` с привязкой к реальному коду и конвенциям из CLAUDE.md:
  `vire-architecture` (слои handler→service→repo, Result, DI, zod),
  `vire-media` (FFmpeg/HLS-конвейер, waveform, vault/stream), `vire-testing`
  (Vitest/TDD по слоям, регресс на инциденты, гейты), `vire-queues` (BullMQ
  producer/consumer, идемпотентность/jobId, грабли Drizzle). Едут в репозитории.
