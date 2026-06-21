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
- [x] **TECHNICAL_DEBT.md** — создан `docs/TECHNICAL_DEBT.md`: JWT без refresh, `'unsafe-inline'` в CSP, отсутствие retry в воркере, прямые инсерты play_events, один владелец артиста.

## Надёжность

- [x] **Воркер: надёжность** — retry/backoff + removeOnFail (DLQ-поведение) уже в `lib/queue.ts`. Добавлено: статус `FAILED` (миграция 0021), на финальном падении транскодинга трек PROCESSING→FAILED + письмо артисту (Brevo), `FAILED` в админ-«требует внимания» и бейджах дашборда. Идемпотентность по `track_id` подтверждена (skip если READY; FAILED не затирает READY/BLOCKED). Миграции в деплое переставлены ДО `up -d`. (v1.0.66)
- [ ] **Observability** — Sentry (фронт + бэк), JSON-логи с `request_id`, метрики: латентность API, длина BullMQ-очереди, % успешного транскодинга, ошибки HLS/вебхуков.

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
- [ ] **Несколько аккаунтов на одного артиста** — возможность привязать несколько user-аккаунтов к одному `artist_profile`, возможно с разными ролями (owner / collaborator / manager). Нужна новая таблица `artist_members` или расширение `track_contributors`.
- [ ] **Актуализировать дорожную карту** — занести всё сделанное по факту в этап 1 в CLAUDE.md/concept.md и переформировать этапы 2–4 с учётом реального состояния.
- [x] **Индексация в поисковиках** — перенесено в блок Performance & SEO выше (детали там).
- [ ] **Пресейвы — Фаза B (смартлинки ↔ Vire + внешние платформы)** — Фаза A (нативный
  пресейв на Vire: кнопка на экране отсчёта, авто-выход SCHEDULED по дате, авто-лайк +
  письмо) сделана (см. `docs/features/presaves.md`). Осталось:
  - Привязка смартлинка к релизу Vire: `release_id` FK в `smart_links`; страница
    смартлинка авто-подхватывает обложку/название/дату релиза.
  - Первой кнопкой на смартлинке — «Слушать на Vire» (если вышел) / «Пресейв на Vire»
    (если SCHEDULED, нативный пресейв из Фазы A). Иконка Vire (есть `Logo`/`BrandIcon`).
  - Внешние пресейв/follow-ссылки артиста (Spotify/Apple/Яндекс) кнопками на смартлинк/
    пресейв-странице — без OAuth, просто ссылки, которые вставляет артист (решено в чате).
  - Кнопка пресейва в секции «Скоро выйдет» на странице артиста (сейчас там только ссылка
    на релиз; нужен per-release presave-state — N запросов или батч).
  - Редактор смартлинка в дашборде: дропдаун выбора релиза + поля внешних ссылок.
- [x] **Explicit-бейдж (E) на карточках релизов** (21.06.2026). Агрегат `hasExplicit`
  (коррелированный EXISTS по `tracks.is_explicit`) добавлен в `releaseCardColumns`
  (`discovery.ts` → `DiscoveryRelease`: главная/каталог/upcoming) и в `getFeed` (`feed.ts`
  → лента). Для страницы артиста (доменный `Release` без explicit-данных) — хелпер
  `getExplicitReleaseIds(ids)` одним запросом. Рендер: `ReleaseQuickLook` (бейдж у названия
  карточки) и `FeaturedRelease` (у героя). Покрывает главную, ленту, профиль артиста,
  каталог `/releases`. Смартлинки — отдельно в блоке пресейвов Фаза B.

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
