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
- [ ] **OG-изображение по умолчанию** — главная и артисты без аватара отдают пустой `ogImage`. Нужна картинка `public/og-default.jpg` и fallback в `metadataBase` / `openGraph.images`.

## Архитектура

- [x] **Architecture Audit** — `packages/core` чистый: только внутренние импорты + vitest в тестах. Нарушений нет.
- [x] **TECHNICAL_DEBT.md** — создан `docs/TECHNICAL_DEBT.md`: JWT без refresh, `'unsafe-inline'` в CSP, отсутствие retry в воркере, прямые инсерты play_events, один владелец артиста.

## Надёжность

- [ ] **Воркер** — retry с экспоненциальным backoff, dead letter queue, уведомление артисту при падении транскодинга. Проверить идемпотентность по `track_id`.
- [ ] **Observability** — Sentry (фронт + бэк), JSON-логи с `request_id`, метрики: латентность API, длина BullMQ-очереди, % успешного транскодинга, ошибки HLS/вебхуков.

## Качество

- [x] **Тесты `packages/core`** — добавлены тесты `ReleaseService.deleteRelease` (4 кейса); `makeRepo` исправлен (добавлены `delete`, `updateStatus`, `findAllByArtist`). Итого: 33 теста.
- [ ] **Mobile polish** — Impeccable critique + polish плеера и волны на мобильных. Waveform scrubber на тач, управление треками на узких экранах.

## Этап 2

- [ ] **Фундамент прямых продаж** — purchase service в `packages/core`, вебхуки ЮКасса (верификация подписи, идемпотентность), Signed URL на FLAC. YooKassa боевая настройка `SHOP_ID`/`SECRET_KEY`.
- [ ] **Тесты Этап-2 роутов** — покрыть `purchase` и `webhooks/yookassa`.

## Фичи

- [x] **Блок хоткеев на странице /about** — секция 06 с таблицей всех клавиш в `about-content.tsx`.
- [x] **Пасхальное яйцо: Konami → попап** — Konami теперь открывает попап с кнопкой `/secret`; тройной клик по копирайту — дождь иконок по-прежнему.
- [x] **Создать страницу /secret** — сделана как `/fwqa688` (терминал-пасхалка).
- [ ] **Несколько аккаунтов на одного артиста** — возможность привязать несколько user-аккаунтов к одному `artist_profile`, возможно с разными ролями (owner / collaborator / manager). Нужна новая таблица `artist_members` или расширение `track_contributors`.
- [ ] **Актуализировать дорожную карту** — занести всё сделанное по факту в этап 1 в CLAUDE.md/concept.md и переформировать этапы 2–4 с учётом реального состояния.
- [ ] **Индексация в поисковиках** — Яндекс.Вебмастер: подтвердить через метатег (v1.0.56). Google Search Console: добавить сайт и отправить sitemap. Проверить noindex на страницах.

## Фидбек пользователей

- [x] **Баг: показать пароль при регистрации** — кнопка не работала (контролируемый input с `value=` блокировал смену `type`). Фикс: убрать `value`, оставить `onChange`. (21.06.2026, 021002masha@mail.ru)
- [x] **Идея: Ctrl+F для поиска** — добавлен как алиас Ctrl+K в command-palette.tsx. (21.06.2026, samarskipanki@gmail.com)

## Skills

- [ ] Установить через marketplace: FFmpeg Media Expert, Clean/Hexagonal Architecture, Testing/TDD, BullMQ + Drizzle.
