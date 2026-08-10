# VireMusic — инструкция для Claude Code

Независимая музыкальная площадка для артистов и слушателей СНГ.
Полная документация: `docs/vision/concept.md`, `docs/foundation/architecture.md`, `docs/foundation/data-schema.md` (карта всех доков — `docs/README.md`).

## Рабочий процесс (обязательно)

**Любая нетривиальная задача** (фича, смена поведения, рефактор >1 файла, нетривиальный
баг) идёт через скилл **`vire-loop`** — инженерный цикл Requirements→Design→Implementation
→Testing→Ship поверх Superpowers. Вызывай его ДО кода. Не прыгать сразу в реализацию.
Тривиалку (опечатка/переименование/копирайт) — мимо цикла.

**Веди цикл автономно до конца** — не спрашивай согласования между фазами; спрашивай
только продуктовые развилки (что строим) и необратимое (деплой/удаление/push). Реализацию
и ресёрч по готовому плану делегируй сабагентам, не главной сессии.
Роутинг моделей: Opus — суждение (дизайн/план/дебаг), Sonnet — реализация/ревью,
Haiku — поиск/маппинг/тривиал.

**Делегируй по критерию, а не по умолчанию.** Сабагент оправдан на крупной независимой
и параллелизуемой работе (широкий многофайловый ресёрч, независимые срезы реализации).
Не делегируй то, что закрывается парой tool-call'ов, и не поднимай сабагента, чтобы
перепроверить собственную работу. Хватает одного — запускай одного; счётчик держи низким.

## Как отвечать и вести работу

- **Кратко.** Дисклеймеры и оговорки — коротко, основной объём ответа на сам ответ.
  Просят объяснить — сначала верхнеуровневое резюме, развёрнутое только по запросу.
- **Ход работы.** Перед первым tool-call'ом — одна фраза о том, что собираешься сделать.
  Дальше сообщай, только когда нашёл важное или сменил направление. В конце начинай
  с результата: первая фраза отвечает «что вышло / что нашёл», детали — после неё.
- **Длина артефактов.** Спеки/планы/фичедоки/ledger пиши по существу задачи: покрой суть,
  но без филлер-секций, дублирующих резюме и boilerplate. Это то же правило, что и
  «минимум комментариев», только про документы.
- **Границы задачи.** Делай то, что попросили, в том объёме, в каком просили. Рутинные
  развилки решай сам; спрашивай, только если разные прочтения ведут к принципиально
  разной работе. Считаешь просьбу ошибочной — скажи одной фразой и продолжай как просили,
  не сужая и не расширяя молча. Доводи задачу целиком, а не лёгкую часть.
- **Самопоправки.** Поправляй прежнее утверждение, только если ошибка меняет код, выводы
  или решения. Поправил — коротко и дальше по делу; мелочь, которая ничего не меняет,
  правь молча.

## Стек

- **Монорепо:** Turborepo + pnpm workspaces
- **Фронт + API:** Next.js 15 (App Router), TypeScript strict
- **UI:** Radix Primitives / shadcn (headless) + Tailwind — кастомные токены, не дефолтный shadcn
- **База:** PostgreSQL + Drizzle ORM (`packages/db`)
- **Очередь:** Redis + BullMQ
- **Хранилище:** S3-совместимое — MinIO (и на проде за Caddy на `cdn.viremusic.ru`, и локально)
- **Транскодинг:** ffmpeg-воркер (`apps/worker`), HLS-нарезка
- **Аутентификация:** Auth.js (NextAuth)
- **Деплой:** Timeweb Cloud VPS + Docker (Caddy → web/worker из GHCR); CI/CD по тегу `vX.Y.Z`

## Структура монорепо

```
apps/
  web/        — Next.js: фронт + API (Route Handlers /api/v1/*)
  worker/     — BullMQ воркеры: транскодинг, рассылки
packages/
  core/       — бизнес-логика, use-cases (чистый TS, НЕ зависит от Next)
  db/         — Drizzle схема + миграции + клиент (@vire/db)
  api-contracts/ — zod-схемы запросов/ответов, общие типы
  api-client/ — типизированный fetch-клиент
  ui/         — общий UI-кит (Radix + кастомный Tailwind)
  media/      — утилиты HLS, waveform
  config/     — tsconfig, eslint, tailwind preset
docs/         — концепция, архитектура, схема данных
```

## Архитектурные правила (обязательно соблюдать)

### Слои — строго сверху вниз

```
Route Handler (apps/web/app/api)     — только HTTP: валидация входа, вызов сервиса, ответ
        ↓
Service / Use-case (packages/core)   — вся бизнес-логика
        ↓
Repository (packages/db)             — запросы к БД
        ↓
PostgreSQL
```

- Хендлер не знает про БД
- Сервис не знает про HTTP
- Репозиторий не знает про бизнес-правила
- `packages/core` не импортирует ничего из Next.js

### FSD на фронтенде

```
app/ → pages/ → widgets/ → features/ → entities/ → shared/
```

Импорт только вниз по слоям. Публичный API слайса — только через `index.ts`.

### Лейаут и скролл (app-shell)

Корневой `app/layout.tsx` — это app-shell фиксированной высоты: `<html h-full>`,
`<body h-full overflow-clip>`. Скролла на уровне документа нет. Внутри:

```
body (h-full, overflow-clip, flex flex-col)
  Nav                                  — закреплён сверху
  div (flex-1, min-h-0, overflow-y-auto)  — единственная скролл-область (обычный блок!)
    {children}
  Player                               — элемент потока снизу (h-16), только когда играет
```

Правила, чтобы не вернуть «лишний» скролл документа:

- **Никогда `min-h-screen` / `h-screen` на страницах и лейаутах.** 100vh + высота Nav +
  плеер всегда дают переполнение. Высоту даёт скролл-область, страница заполняет её
  через `min-h-full` (фон на всю область; центрирование — `min-h-full flex … justify-center`).
- **Скролл-область — НЕ flex-контейнер.** Если сделать её `flex flex-col`, дочерняя страница
  становится flex-элементом с `flex-shrink:1` и при высоком контенте сжимается до высоты
  области (особенно с `min-h-full`), контент вываливается под плеер, а скролл не появляется.
  Обычный блок со `overflow-y-auto` скроллится корректно.
- Скролл — внутри контентных модулей, а не страницей целиком. Если модуль (таблица,
  длинный список, сайдбарный лейаут) может переполниться — вешай `overflow-y-auto` +
  `min-h-0` на него, а не на страницу. Пример: `app/admin/layout.tsx` — сайдбар
  закреплён, скроллится только `<main>`.
- **На body и обёртках — `overflow-clip`, не `overflow-hidden`.** `hidden` оставляет
  элемент программно-скроллируемым: `scrollIntoView`/фокус за краем сдвигает весь документ,
  а скроллбара вернуть его нет («дыра» слева, v1.11). `clip` не создаёт скролл-контейнер.
  Нюанс спеки: `clip` по одной оси + `visible` по другой → `visible` вычисляется как `auto`
  (появляется лишний скроллер), поэтому на скролл-пейнах ось X клипается только там, где
  ось Y уже `auto` (см. `(listener)/layout.tsx` — `md:overflow-x-clip`).
- **Композит-слои в скролл-области = джиттер.** Конечные entrance-анимации — только
  `fill backwards`/без fill (fill `both`/`forwards` держит завершённую анимацию «в силе» —
  Chromium не демотирует слой, соседи каскадом промоутятся overlap'ом). Бесконечные
  transform/opacity-анимации (`animate-ping`) на постоянно видимых элементах запрещены —
  пульс через `animate-live-pulse` (box-shadow). После UI-прохода проверять слои CDP
  `LayerTree` (Playwright): в скролл-области должно быть 0 слоёв.
- Инварианты защищены тестом `app/__tests__/layout-shell.test.ts` (вкл. запрет fill
  both/forwards на конечных анимациях в globals.css).

### Чистота кода

- **Комментарии — почти никогда.** Код по умолчанию без комментов. Допустимо только
  неочевидное «почему» (обход бага платформы, невидимый инвариант) и строго в 1–2 строки.
  Эссе, пересказ «что делает», нарратив правок, ссылки на версии/спеки — запрещены;
  знанию длиннее двух строк место в `docs/features/*.md`. Требование распространяется
  на сабагентов-реализаторов.
- Бизнес-правила — чистые функции (одинаковый вход → одинаковый выход)
- Все эффекты (БД, S3, время, случайность) — за интерфейсами, инъектируются
- Время: не `new Date()` в логике, а инъектируемый `Clock`
- Ошибки как значения (`Result<T, E>`), не исключения сквозь слои
- Любой внешний вход валидируется через zod до попадания в логику

### TypeScript

- `strict: true` везде
- Никаких `any` без явной причины и комментария
- Типы выводятся из zod-схем — один источник правды

## База данных

Схема в `packages/db/src/schema/`, ключевые решения:

- `track_contributors` с `payout_share numeric(5,2)` — не `artist_id` в треке напрямую
- `rights_holders` отдельно от `artist_profiles` (бренд ≠ получатель денег)
- Файлы в S3 по `/vault/tracks/{track_id}/source.flac` — не по артисту
- `play_events` — аналитический лог, пишется через буфер, не прямым инсертом
- `theme_tokens` JSONB в профиле артиста — темизация на уровне данных
- `subscriptions.type` полиморфный: `ARTIST_TIER` | `LISTENER_PREMIUM`
- `artist_posts` — анонсы/новости артиста (FK на профиль, `onDelete: cascade`)
- Live-присутствие («слушают сейчас») живёт в Redis (ZSET), не в Postgres

Команды:
```bash
pnpm --filter @vire/db db:generate   # сгенерировать миграцию
pnpm --filter @vire/db db:migrate    # применить миграции
pnpm --filter @vire/db db:studio     # открыть Drizzle Studio
pnpm --filter @vire/db db:make-admin <email> [role]  # выдать роль (default SUPERADMIN); юзер должен перелогиниться
```

## Медиа и аудио

- Артист заливает FLAC → воркер режет в HLS (`.m3u8` + чанки) → `apps/worker`
- Стриминг в плеере только через HLS (`hls.js`), никаких прямых ссылок на mp3/flac
- FLAC отдаётся только по Signed URL после покупки
- Waveform — предрассчитанные пики в `track_audio.waveform_peaks` (JSONB), без Web Audio API

## Темизация

Три слоя:
1. **Оболочка платформы** — нейтральная, свои токены
2. **Страница артиста** — `artist_profiles.theme_tokens` из БД инжектируется как CSS-переменные в корневой div
3. **Плеер** — нейтральный, подхватывает акцентный цвет текущего релиза

Компоненты пишутся на `bg-[var(--artist-bg)]`, `text-[var(--artist-text)]` — без форков кода.

## Локализация (ru/en)

Публичная часть, дашборд, соцслой, письма и пуш — на ru (по умолчанию, URL без префикса)
и en (`/en`-префикс). Детали — `docs/features/i18n.md`.

- Строки только в `packages/i18n/messages/{ru,en}/<namespace>.json`, ru и en заполняются
  **одновременно** в одном изменении — не оставлять словарь расходящимся между локалями.
- Внутри `app/[locale]/**` и `components/**` (кроме `components/admin/**`) — навигация
  только через `Link`/`redirect`/`usePathname`/`useRouter`/`getPathname` из
  `@/i18n/navigation`, не из `next/navigation`/`next/link`.
  `useSearchParams`/`notFound`/`useParams` остаются из `next/navigation`.
- `/admin` и внутренняя витрина `/design` не локализуются (backoffice и dev-инструмент,
  не продукт для конечного пользователя) — это статус-кво, а не пробел.
- Выбор языка пользователя — `users.locale` (nullable, фолбэк `ru`); письма/пуш берут
  локаль получателя из БД на момент отправки, не из JWT (локаль в токен не кладётся).
- Гейт `pnpm --filter @vire/web check:i18n` (в `prebuild` и CI `gates`) падает на
  кириллице вне словарей в локализованной зоне — гонять как typecheck/lint/test.

## Локальная разработка

```bash
# инфраструктура (postgres + redis + minio)
docker compose up -d

# все пакеты
pnpm install

# дев-режим
pnpm dev

# только web
pnpm --filter @vire/web dev
```

> ⚠️ Загруженные треки висят в PROCESSING, а в админке очередь transcode копит
> «в ожидании»? Значит не запущен **worker** (`pnpm --filter @vire/worker dev`).
> `pnpm dev` из корня поднимает и web, и worker. Ставить трекам READY руками
> нельзя — без прогона воркера у них нет HLS-манифеста (в админке маркер `!hls`),
> плеер скажет «нет файлов».

Переменные окружения: скопируй `.env.example` в `.env` и заполни.
DATABASE_URL для локалки: `postgresql://vire:vire@localhost:5432/vire`

## Документация фич

Каждая фича описывается файлом в `docs/features/` (что делает, где код, env,
ограничения — шаблон в `docs/features/README.md`). **Новая фича не считается
готовой без файла в `docs/features/`.** Безопасность — `docs/security/owasp-top-10.md`.

## Проверки качества (гонять после каждого набора изменений)

```bash
pnpm --filter @vire/web typecheck      # tsc --noEmit
pnpm --filter @vire/core typecheck     # tsc --noEmit
pnpm --filter @vire/db typecheck       # tsc --noEmit
pnpm --filter @vire/web lint           # eslint
pnpm --filter @vire/web check:routes   # инвариант роутинга (см. ниже)
pnpm --filter @vire/web check:i18n     # кириллица вне словарей packages/i18n/messages
pnpm --filter @vire/web test           # vitest
pnpm --filter @vire/web audit:design   # Impeccable — детектор дизайн-анти-паттернов
pnpm --filter @vire/web build          # прод-сборка (prebuild гоняет check:routes + check:i18n)
pnpm audit --audit-level=high          # из корня; гейт CI, локально о нём легко забыть
```

> ⚠️ `pnpm audit` живёт только в CI и валит job `gates` **до** сборки образов — свежая
> advisory на транзитивную зависимость роняет релиз, даже если код не трогали (так слетел
> тег v1.48.0 на `nanoid`). Гоняй его перед тегом. Чинить — через `pnpm.overrides` в
> корневом `package.json`, и **кареткой, а не `>=`**: открытый диапазон утягивает пакет на
> свежий мажор (`nanoid` уехал на 6.x ESM-only, которого `postcss` не ждёт). `pnpm update`
> для этого не годится — поднимает вторую копию нативных пакетов рядом со старой.

> CI (`gates`) гоняет typecheck единым `pnpm turbo run typecheck` — таск в `turbo.json`
> без scope-фильтра, подхватывает любой пакет со своим script `typecheck` (сейчас
> `@vire/web`, `@vire/core`, `@vire/db` и остальные). Добавлять отдельный CI-шаг под
> каждый пакет не нужно — turbo уже фанаутит.

> ⚠️ **Рантайм-баги старта сервера typecheck/lint/test/build НЕ ловят.** Так уже
> один раз слёг прод (v1.0.70): два соседних динамических сегмента с разными
> именами (`app/api/v1/releases/[id]` рядом с `[releaseId]`) — Next кидает
> «You cannot use different slug names for the same dynamic path» **только в
> рантайме на каждый запрос** (вкл. `/api/health`, favicon), а `next build`
> компилирует молча. Барьеры в CI (`.github/workflows/deploy.yml`, job `gates`):
> **(1)** `check:routes` — статический детектор конфликта имён сегментов
> (`scripts/check-route-slugs.mjs`, висит и на `prebuild`); **(2)** smoke —
> поднимает прод-артефакт `apps/web/.next/standalone/apps/web/server.js` и дёргает
> `/robots.txt` (роут без БД): любой 5xx красит CI. Новые динамические сегменты
> называй так же, как соседние (`[releaseId]`, не `[id]`).
>
> ⚠️ **Второй класс той же беды — нативные зависимости** (прод слёг на v1.34.0).
> `sharp` собран под платформу, а libvips он грузит `dlopen`'ом по RPATH — трейсер Next
> его не видит и молча кладёт в образ биндинг без библиотеки. Локальная сборка на Windows
> это не воспроизводит (там libvips вшит в тот же пакет). Правила: нативные модули
> импортировать **лениво внутри try** (сбой деградирует, а не роняет сегмент — статический
> `import sharp` уронил страницы артиста целиком, потому что `opengraph-image.tsx` входит
> в граф модулей страницы); проверять такое **сборкой Docker-образа**, не локальной.
> Барьер (3): `apps/web/Dockerfile` валит сборку, если в standalone нет `libvips-cpp.so.*`.

**Impeccable** (`audit:design`) — равноправный гейт качества рядом с typecheck/lint/test:
детектит дизайн-анти-паттерны (дефолтные шрифты, серый текст на цвете, pure-gray без
подкраски, лишняя вложенность карточек, bounce-easing, низкий контраст). Закреплён как
devDependency `impeccable` (пакет = github.com/pbakaus/impeccable). Скилл-команды
`/impeccable …` (audit/critique/polish/delight) — ставятся отдельно: `npx impeccable skills install`.
Принципы Impeccable применяем по умолчанию во всей дизайн-работе.

## Текущий статус

**Этап 1 (Friends & Family) — завершён.** Этап 2 (прямые продажи) — частично.

### Фундамент
- [x] Монорепо (Turborepo + pnpm), docker-compose (postgres/redis/minio)
- [x] `packages/db` — Drizzle схема + миграции 0000–0044
- [x] `packages/core` — Result<T,E>, domain types, сервисы (Artist/Release/Track,
  Follow/ListenerTrack/TrackMoods/Playlist, ArtistPost/SmartLink, Wave/Search/Presave,
  Auth, Purchase), репозитории
- [x] `packages/ui` — OKLCH-токены, Button, Card, Input
- [x] `packages/config` — tsconfig/eslint/tailwind пресеты
- [x] Auth.js v5 — провайдеры: email/пароль (Credentials), magic link, Yandex; JWT,
  `proxy.ts`. Google/Telegram вырезаны (406-ФЗ — иностранные сервисы авторизации
  запрещены). Привязка нескольких провайдеров к одному аккаунту через cookie
  `vire_link_uid` (см. `auth.ts`, `/profile` → «Способы входа»).
  Письма шлёт Brevo HTTP API (`lib/mailer.ts`) — SMTP не используется (Timeweb блокирует порты).
- [x] `apps/worker` — BullMQ + ffmpeg → HLS + waveform peaks → S3 → DB; play-events; notify-release

### Публичные страницы
- [x] `/` — главная (контент-хаб + кнопка запуска потока), `/artists` — каталог + поиск, `/search` — поиск SSR
- [x] `/artists/[slug]` — профиль: full-bleed hero, темизация, grain, ссылки, видео, follow, анонсы
- [x] `/artists/[slug]/releases/[releaseId]` — релиз, трек-лист, liner notes, credits
- [x] `.../tracks/[trackId]` — waveform-плеер, BPM/key, like, live-счётчик
- [x] `/profile` — карточка профиля (смена имени, загрузка своего
  аватара в S3, «Способы входа»: пароль + привязка OAuth/Telegram), лайки, подписки, покупки
- [x] «Ваша лента» на главной — ранжированные релизы/скорые релизы/анонсы подписок +
  вкуса с подписью-причиной, `/feed` — redirect на `/` (`docs/features/feed.md`)
- [x] Глобальный плеер — Zustand (persist `vire-player`, переживает перезагрузку) +
  HLS.js + единый waveform scrubber + LRC, wave-режим; редизайн UI на
  mini-bar/fullscreen/controls/queue-panel (`docs/features/player.md`)
- [x] `/releases` — каталог релизов (сортировка свежесть/популярность, прогрессивный
  показ по 24 «Показать ещё»); explicit-бейдж (E) на карточках релизов везде, где видна
  обложка (`hasExplicit` агрегат, `docs/features/...`)
- [x] Смартлинки (bandlink-лендинги) `/smartlink/{artist}/{slug}` + хаб на странице артиста;
  **Фаза B**: привязка к релизу VireMusic (`release_id`) → кнопка «Слушать/Пресейв на VireMusic»
  (`docs/features/smart-links.md`)
- [x] Пресейвы релизов (Фаза A+B): нативный пресейв на экране отсчёта, авто-выход
  SCHEDULED по дате, авто-лайк + письмо, инлайн в «Скоро выйдет» (`docs/features/presaves.md`)
- [x] Курируемые/алгоритмические + пользовательские плейлисты на главной — личные
  ранжированы по единому профилю вкуса (mood+genre) и популярности; личные mood-подборки
  не дублируют общие дневные, порог наполнения 5 треков (`docs/features/curated-playlists.md`)
- [x] `ScrollRow` (`components/scroll-row.tsx`) — горизонтальные ленты (чипы «Потока» и др.):
  свайп на таче; на hover-устройствах — полновысотные краевые зоны с градиентом-шторкой
  и шевроном, видны всегда, пока есть куда листать (`pointer-fine:flex`); ширина зоны —
  проп `edgeZone` (`sm` для чипов); отрицательные маргины-выпуски — в `bleedClassName`
  (на обёртке), чтобы зоны стояли по настоящему краю ленты

### Взаимодействие слушателя (концепт «Взаимодействие слушателя» — закрыто)
- [x] Лайк трека (плеер + трек-лист + страница трека, синхронизация состояния)
- [x] Плейлисты — `/playlists/[id]`, добавление трека, приватность, переименование/удаление
- [x] Теги настроения (`track_moods`) + mood-picker; **Волна** ступень 2 — теги+жанры
  (`track_genres`)+BPM+Camelot-тональность+профиль вкуса, Redis-сессия анти-повтора
  (`wave:served` ZSET) + закреплённый seed mood/genre, пачки 1–5 треков, автоплей
  при исчерпании очереди (`docs/features/wave.md`)
- [x] Любимые моменты — анонимные маркеры на волне (`favorite_moments`), агрегат на странице трека
- [x] Шеринг с таймкодом — `TrackShare` поповер (ссылка / «с момента M:SS») в плеере и на треке
- [x] PWA — приложение устанавливается (SW с fetch-обработчиком, манифест с `id`/`scope`/
  shortcuts/maskable), оболочка и статика из кэша, скачивание треков в Cache Storage и
  экран «Скачанное» `/offline`; библиотека привязана к аккаунту (`docs/features/pwa-offline.md`)
- [x] Live «слушают сейчас» — Redis-присутствие (ZSET + окно 45с), heartbeat из плеера;
  показ слушателю (трек) и артисту (дашборд); деградирует до 0 при сбое Redis (`lib/presence.ts`)
- [x] Синхронизированный текст — LRC в `tracks.lyrics`; редактор в дашборде, подсветка
  строки по таймкодам в фуллскрин-плеере (`lib/lrc.ts`, `docs/features/lyrics.md`)
- [x] Социальный слой — двусторонняя дружба, профиль `/u/[userId]` с гейтом видимости лайков
  (`social_visibility`), экран `/friends`, поиск людей; блокировка (`user_blocks`), жалобы
  (`reports` + `/admin/reports`), уведомления-колокольчик (`notifications`); активность друзей
  на главной; чат 1:1 на SSE (`/messages`) (`docs/features/{social-friends,chat,notifications}.md`)

### Dashboard артиста (`/dashboard`)
- [x] Список релизов со статусами + статистика прослушиваний + live «слушают сейчас» в шапке
- [x] `/dashboard/releases/new` — создание релиза; `/dashboard/releases/[id]` — редактирование
- [x] `/dashboard/profile` — имя, bio, аватар, тема (live color picker, расширенные пресеты),
  grain, шрифты (13 sans + 5 mono, каталог `lib/font-catalog.ts` отдельно от загрузчиков
  `lib/fonts.ts` — next/font не выполняется в Vitest)
- [x] Анализ жанра on-demand — кнопка «Определить жанр» в редакторе трека (дашборд и
  `/admin/tracks/[id]/edit`): очередь `analyze-genre` (BullMQ `deduplication`, НЕ фикс. jobId),
  воркер качает source из S3 и гонит discogs-effnet ONNX, топ-5 с уверенностью в
  `track_audio.genre_suggestions`, поллинг по `updatedAt` (`docs/features/auto-genre.md`)
- [x] `/dashboard/posts` — анонсы/новости: композер + инлайн-редактирование + оптимистичное удаление
- [x] Загрузка треков (FLAC → S3 → BullMQ), PublishButton (DRAFT→PUBLISHED/SCHEDULED)
- [x] Аналитика переслушиваний — возвраты к треку (2+ разных дня) в `StatsSection`

### Backoffice (`/admin`, только MODERATOR/ADMIN/SUPERADMIN)
- [x] Обзор: «требует внимания» (зависшие/заблокированные треки, неверифицированные артисты);
  **система** (пинг Postgres/Redis, live-слушатели, BullMQ-очереди с ошибками — `lib/admin-health.ts`);
  аудитория/каталог (юзеры по ролям, артисты, релизы/треки по статусам); вовлечённость
  (прослушивания 24ч/7д/30д, уник. слушатели, лайки/подписки/плейлисты/посты/теги/моменты)
- [x] `/admin/analytics` — динамика прослушиваний по дням (14д), топ треков/артистов за 30д;
  история платформы из `platform_metrics_daily` (ежедневный снапшот-воркер `metrics-daily`,
  графики роста 30/90/180д — `docs/features/platform-metrics.md`)
- [x] `/admin/users` (смена роли + верификация, форма «Создать артиста» по email),
  `/admin/artists` (фолловеры/релизы/прослушивания, верификация + скрытие с витрины isActive),
  `/admin/tracks` (аудио-характеристики, прослушивания, лайки, маркер `!hls`),
  `/admin/releases` (смена статуса)
- [x] Адаптивная вёрстка: на десктопе сайдбар сбоку, на мобилках — горизонтальный
  топ-бар; широкие таблицы скроллятся по горизонтали (`overflow-x-auto` + `min-width`)
- [x] **UX/дизайн-доводка админки (v1.4.0–1.4.2)** — единый дизайн-кит
  `components/admin/ui.tsx` (токены вместо `white/X`, бейджи статусов, состояния,
  таблицы, пустые состояния), раскатан по всем страницам; редактор трека
  (кастомные чекбоксы + подписи, жанры пилюлями), CPU current+avg, live-статус
  треков. Детали и хвосты — `docs/roadmap/stage-2.md` §9.6.

### SEO и доступность
- [x] `metadataBase` + title-template `%s — VireMusic`, OG/Twitter дефолты (`app/layout.tsx`, `lib/site.ts`)
- [x] `generateMetadata` артиста/релиза/трека: canonical + OG `profile`/`music.album`/`music.song`
- [x] `app/robots.ts`, `app/sitemap.ts` (артисты + релизы из БД), `app/manifest.ts`
- [x] Schema.org JSON-LD — `MusicGroup`/`MusicAlbum`/`MusicRecording` (`lib/structured-data.ts`,
  `<JsonLd>`); билдеры — чистые функции, покрыты тестами
- [x] a11y: skip-link, `:focus-visible` обводка, `cursor: pointer` на кнопках (Tailwind v4 убрал
  дефолт), `prefers-reduced-motion` глушит анимации; entrance-анимация `animate-fade-up`
- Базовый URL — `NEXT_PUBLIC_SITE_URL` → `AUTH_URL` → localhost (`lib/site.ts`)

### Этап 2 (прямые продажи) — частично, UI скрыт с витрины
**Покупок в Этапе 1 нет:** весь purchase-UI отвязан от публичных страниц до старта Этапа 2.
Бэкенд-код сохранён: API-роуты (purchase/download/webhook), `download-button.tsx` и
`purchased-track-row.tsx` лежат неподключёнными — вернуть при старте Этапа 2.
- [x] Покупка трека: `POST /api/v1/tracks/[id]/purchase` → YooKassa redirect → webhook → PAID
- [x] Скачивание FLAC по presigned S3 URL
- [ ] **YooKassa боевая настройка** — SHOP_ID/SECRET_KEY + вебхук в кабинете ЮKassa

### Тесты (apps/web — 1777, гонять `pnpm --filter @vire/web test`)
- [x] `packages/core` — сервисы artist/release/track, follow/listener-track/track-moods/playlist, Result/errors (Vitest)
- [x] `apps/web/lib` — `embed` (YouTube/VK), `upload` (валидация), `format`, `structured-data` (JSON-LD билдеры)
- [x] Route handlers Этап 1 (права + валидация): upload, dashboard releases (create/edit/status),
  dashboard profile, dashboard posts (create/edit/delete), follow, like, play, download,
  tracks/listening (presence) — `app/api/**/route.test.ts`
- [x] Route handlers остатка (1-H): health/v1 health, admin backfill-analysis/editorial/system,
  artists/[slug], listening-now, dashboard live, dashboard tracks/[id]/genres + PATCH/DELETE,
  user/profile PATCH/POST, feedback, nextauth rate-limit
- [x] App-shell лейаут — инвариант `app/__tests__/layout-shell.test.ts` (нет `min-h-screen`)
- [x] `apps/worker` — transcode-пайплайн (`processTranscodeJob`: идемпотентность, derive ext,
  HLS-загрузка, READY-транзакция, fallback на ffprobe) + waveform-пики (`peaksFromPcm`)
- [x] Route handlers Этап 2 (purchase, webhooks/yookassa) — покрыты (1-J)

## Что делать дальше (следующий шаг)

Этап 1 закрыт, включая все взаимодействия слушателя из концепта, смартлинки,
пресейвы (Фаза A+B) и несколько аккаунтов на артиста (`docs/features/multi-artist.md`).
Открытый бэклог — в `docs/roadmap/TODO.md` (Observability/Sentry — отложено до апгрейда
VPS, контент-SEO) и `docs/roadmap/stage-2.md` (второй виток); Этап 2 — только по команде:
1. **YooKassa боевая настройка** — по команде
2. Открытые хвосты stage-2: §7.2 (editorial)

Сделано в доводке:
- Форматтеры (`formatDuration`, `formatCount`, `pluralTracks`, `releaseYear`, `totalDuration`)
  централизованы в `apps/web/lib/format.ts` и покрыты тестами.
- Все удалённые изображения (обложки/аватары из S3) — на `next/image`; хост S3/MinIO задаётся
  через `images.remotePatterns` в `next.config.ts` из `S3_PUBLIC_ENDPOINT`. Разрешены и хосты
  OAuth-аватаров: `avatars.yandex.net`, `lh3.googleusercontent.com` (Google), `t.me` (Telegram).
  Локальные blob-превью в формах остаются `<img>` (next/image не оптимизирует blob:).
  После правки `next.config.ts` dev-сервер нужно перезапустить. CSP/remotePatterns/`S3_PUBLIC_ENDPOINT`
  пекутся на build-time — в Docker передаются через build-args (см. `apps/web/Dockerfile`, `deploy.yml`).
- Свой аватар слушателя грузится через `POST /api/v1/user/profile` (multipart) в S3
  (`avatars/users/{id}.{ext}`), ключ стабильный — к URL добавляется `?v=timestamp` для сброса кэша.
- Live-присутствие использует Redis напрямую (`ioredis`, `lib/presence.ts`) — отдельно от BullMQ-очередей,
  но тот же `REDIS_URL`. Все presence-эндпоинты деградируют до `count:0` при недоступности Redis.

> ⚠️ Не интерполируй JS-`Date` в raw-`sql`-шаблон Drizzle — postgres.js получает её как
> нетипизированный bind-параметр и падает с `ERR_INVALID_ARG_TYPE: Received an instance of Date`.
> Считай дату на стороне SQL (`now() - interval '7 days'`). Через `.set({ updatedAt: new Date() })`
> на типизированной timestamp-колонке `Date` передавать можно — Drizzle знает тип.
> (Передавать `Date` в пропсах Client Component, наоборот, можно — React 19 Flight это сериализует.)

> ⚠️ Не интерполируй колонку (`${tracks.id}`) в `sql`-шаблон внутри `.select()` — Drizzle
> рендерит её там БЕЗ квалификации (просто `"id"`). В коррелированном подзапросе это либо
> «column reference is ambiguous», либо тихо резолвится в id таблицы подзапроса (счётчики = 0).
> Ссылайся на внешнюю таблицу литералом: `where f.artist_profile_id = artist_profiles.id`.

> ⚠️ Роль и identity (имя/аватар) кладутся в JWT **в момент логина** (`jwt`-callback в `auth.ts`).
> Стратегия `jwt` не перечитывает БД — после смены роли (`db:make-admin`, верификация) или
> правки имени/фото пользователь должен **выйти и войти заново**, иначе сессия остаётся старой.
> Поэтому `/profile` читает актуальные имя/аватар из БД (`getUserProfile`), а не из сессии.

> ⚠️ `createArtistForUser` повышает до `ARTIST` только `LISTENER` — роли `MODERATOR`/`ADMIN`/
> `SUPERADMIN` не понижаются. Иначе создание артиста на email админа отбирает доступ к админке
> (так уже один раз слетел SUPERADMIN). При любых изменениях формы «Создать артиста» это сохранять.
