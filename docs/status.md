# Что построено

Сводка состояния продукта по областям: фундамент, веб, дашборд артиста, бэкофис,
клиенты. Лежала в `CLAUDE.md` и занимала там треть файла — а её читают редко,
грузится же она в каждую сессию.

**Дата среза:** 02.09.2026. Соседние документы про то же, но с другой стороны:
`docs/architecture/current-state.md` — фактический срез архитектуры по коду
(масштаб, слои, прогнанные тесты), `docs/features/README.md` — индекс фичедоков,
`docs/roadmap/` — что планировалось и в каком порядке.

---

**Этап 1 (Friends & Family) — завершён.** Этап 2 (прямые продажи) — частично.

### Фундамент
- [x] Монорепо (Turborepo + pnpm), docker-compose (postgres/redis/minio)
- [x] `packages/db` — Drizzle схема + миграции 0000–0058
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

### Тесты (3795 всего, 416 файлов: web 2034 · core 1070 · mobile 389 · worker 118 · db 52 · storage 18 · i18n 87 · api-client 12 · design-tokens 9 · media 6)
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

### Мультиплатформа (`apps/desktop`, `apps/mobile`)

- [x] **Десктоп** (Tauri v2) — window shell, tray + OS media keys, Media Session/SMTC,
  autostart, close-to-tray + глобальный хоткей, single-instance, splash, автообновление,
  мини-плеер поверх других окон, сборка под Windows/Linux (AppImage). Раздача — `/download`
  + GitHub Release + публичный MinIO. Детали — `docs/features/desktop-app.md`.
- [~] **Мобилка** (React Native + Expo, Android) — инкременты 1–28: вход, воспроизведение
  звука (`react-native-track-player`, лок-скрин/Now Playing/фон), SDUI-главная + нативная
  полировка, лайки/плейлисты, shuffle/repeat, диплинк на релиз, друзья (список/заявки/
  поиск/блокировка), просмотр чужого профиля, офлайн-скачивание треков, E2EE-чат
  (веб-совместимый, тред + список диалогов + typing/read), пуш-уведомления (Expo→FCM,
  EAS-проект `@pruffit/vire-mobile` + FCM-креды привязаны), **VireGlass** —
  нативный Expo-модуль `modules/glass-lens` (Kotlin + AGSL `RenderEffect`) для настоящего
  преломления фона + Skia-поверхность, Android 13+. Стекло описывается **моделью материала**
  (`lib/vireglass`: причины — ior/толщина/фаска/шероховатость/плёнка, следствия выводятся),
  геометрия у линзы и поверхности — один текст SDF, стенд — `EXPO_PUBLIC_GLASS_LAB=material`.
  Стекло **само ведёт полярность надписей** на себе: нативный зонд меряет светлоту фона под
  поверхностью, и когда светлый текст перестаёт читаться, он плавно перекрашивается в тёмный.
  **Перемерено 31.08 на устройстве** (2311DRK48G, release, 120 Гц, бюджет кадра 8.33 мс):
  цена поверхности около 0.8 мс GPU — 4 мс на одной, 7 на трёх, 8 на шести. Реальный
  максимум продукта (три) держится с запасом, четвёртую без замера не добавлять.
  Прежние цифры недействительны: до этого узел захвата не получал `setPosition` и линза
  семплировала пустоту (`docs/vireglass/benchmarks/2026-08-31-device-after-capture-fix.md`).
  **Открыто:** порог насыщения (шесть держатся, семь не проверены); слабое железо; 60/90 Гц;
  лок-скрин с PIN, Android Auto, iOS (нет Mac). Детали и честная разбивка проверено/не проверено по каждому инкременту —
  `docs/features/mobile-app.md`. Материал, оптика и решения по рендерингу — `docs/vireglass/`.

  **P0 «Доставка» закрыт** (`docs/features/mobile-app.md` → «Доставка (P0)»): пакет
  `com.virespace.viremusic`, release подписан upload-ключом, прод-URL из `app.json`
  (не из `.env`), `versionCode` в конфиге, крашрепортинг через СВОЙ Sentry-совместимый приёмник (sentry.io отдаёт 403 из России), барьер
  `check:release-config`, сборка одной командой `pnpm --filter @vire/mobile build:android`.
  Подпись, набор ABI и вынос `.cxx` из pnpm-стора живут в config-плагинах
  (`apps/mobile/plugins/`) и переживают `expo prebuild --clean` — сама папка `android/`
  по-прежнему вне git. Два предохранителя первой установки: протухшая сессия уводит на
  экран входа; мобильный E2EE-ключ больше не затирает ключ веб-сессии.
  **Аудит продукта и план реконструкции — `docs/product/`** (матрица паритета
  веб→мобилка, архитектура, дорожная карта P0–P6).


## Доводка

- Форматтеры (`formatDuration`, `formatCount`, `pluralTracks`, `releaseYear`, `totalDuration`)
  централизованы в `apps/web/lib/format.ts` и покрыты тестами.
- Все удалённые изображения (обложки/аватары из S3) — на `next/image`; хост S3/MinIO задаётся
  через `images.remotePatterns` в `next.config.ts` из `S3_PUBLIC_ENDPOINT`. Разрешены и хосты
  OAuth-аватаров: `avatars.yandex.net`, `lh3.googleusercontent.com` (Google), `t.me` (Telegram).
  Локальные blob-превью в формах остаются `<img>` (next/image не оптимизирует blob:).
- Свой аватар слушателя грузится через `POST /api/v1/user/profile` (multipart) в S3
  (`avatars/users/{id}.{ext}`), ключ стабильный — к URL добавляется `?v=timestamp` для сброса кэша.
- Live-присутствие использует Redis напрямую (`ioredis`, `apps/web/lib/presence.ts`) — отдельно
  от BullMQ-очередей, но тот же `REDIS_URL`. Все presence-эндпоинты деградируют до `count:0`
  при недоступности Redis.
