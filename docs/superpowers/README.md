# Журнал инженерного цикла (Superpowers)

Здесь оседает след скилла `vire-loop`: каждая нетривиальная задача проходит фазы
Requirements → Design → Implementation → Testing → Ship, и на фазах Design/Implementation
остаются файлы — план (`plans/`) и дизайн-спека (`specs/`). Пара обычно делит один слаг
и дату: `plans/YYYY-MM-DD-задача.md` + `specs/YYYY-MM-DD-задача-design.md`. Некоторые записи
после сессии получают ledger — короткий итог «что сделано», лежит прямо в `docs/superpowers/`.

**Это журнал момента, не документация текущего состояния.** Файл фиксирует, что было решено
и почему на дату написания, и задним числом не правится — даже если код с тех пор изменился
или решение пересмотрено. Часть планов описывает то, что позже отменили или переделали
иначе; часть спек содержит открытые вопросы, закрытые уже другим документом. Доверять как
источнику «что есть сейчас» нельзя ничему здесь — для этого `docs/features/**`,
`docs/foundation/**`, `docs/vireglass/**`.

93 плана, 96 спек, 2 ledger-файла — 191 файл. Сгруппированы по теме, внутри группы —
от свежих к старым. Не каждому плану соответствует спека и наоборот: часть задач шла с
дизайном без отдельного плана реализации (обычно рефакторинги «вынести в core»), часть —
с планом без дизайн-фазы (мелкие фиксы и QA-пачки).

## Мобилка (React Native + Expo)

Инкременты нативного Android-клиента — от входа до P0/P1/P2 реконструкции по `docs/product/`. Текущее состояние — `docs/features/mobile-app.md` и `docs/features/mobile-player.md`.

- **30.08** — P3 — редизайн фуллскрин-плеера вокруг стеклянной шторки — спека [`2026-08-30-mobile-player-redesign-p3.md`](specs/2026-08-30-mobile-player-redesign-p3.md)
- **29.08** — P2 — плеер после реконструкции — план [`2026-08-29-mobile-p2-player.md`](plans/2026-08-29-mobile-p2-player.md)
- **29.08** — P1 — фундамент после аудита реконструкции — план [`2026-08-29-mobile-p1-foundation.md`](plans/2026-08-29-mobile-p1-foundation.md)
- **29.08** — P0 — доставка: подпись, сборка, крашрепортинг — план [`2026-08-29-mobile-p0-delivery.md`](plans/2026-08-29-mobile-p0-delivery.md)
- **23.08** — Инкремент 17 — пуши (Expo → FCM) — спека [`2026-08-23-mobile-push-notifications-increment-17-design.md`](specs/2026-08-23-mobile-push-notifications-increment-17-design.md)
- **23.08** — Инкремент 14 — тред E2EE-чата — план [`2026-08-23-mobile-chat-thread-increment-14.md`](plans/2026-08-23-mobile-chat-thread-increment-14.md)
- **22.08** — Лайки и плейлисты — план [`2026-08-22-mobile-likes-playlists-plan.md`](plans/2026-08-22-mobile-likes-playlists-plan.md) · спека [`2026-08-22-mobile-likes-playlists-design.md`](specs/2026-08-22-mobile-likes-playlists-design.md)
- **17.08** — Воспроизведение звука (react-native-track-player) — спека [`2026-08-17-mobile-playback-design.md`](specs/2026-08-17-mobile-playback-design.md)
- **17.08** — Инкремент 1 — вход, secure-store, таб-бар, Главная на реальных данных — план [`2026-08-17-mobile-app-increment-1-plan.md`](plans/2026-08-17-mobile-app-increment-1-plan.md) · спека [`2026-08-17-mobile-app-increment-1-design.md`](specs/2026-08-17-mobile-app-increment-1-design.md)

## Веб: мобайл-фёрст адаптив

Срезы 0–7 адаптива `apps/web` под узкий вьюпорт — НЕ про мобильное приложение. Текущее состояние — `docs/features/web-responsive.md` (бывший `mobile-patterns.md`).

- **26.07** — Срез 7 — плотность дашборда артиста — план [`2026-07-26-mobile-slice-7-dashboard-density.md`](plans/2026-07-26-mobile-slice-7-dashboard-density.md) · спека [`2026-07-26-mobile-slice-7-dashboard-density-design.md`](specs/2026-07-26-mobile-slice-7-dashboard-density-design.md)
- **26.07** — Срез 6 — каталоги/списки — план [`2026-07-26-mobile-slice-6-catalogs.md`](plans/2026-07-26-mobile-slice-6-catalogs.md) · спека [`2026-07-26-mobile-slice-6-catalogs-design.md`](specs/2026-07-26-mobile-slice-6-catalogs-design.md)
- **26.07** — Срез 5 — соц-поверхности, `AdaptivePopover` — план [`2026-07-26-mobile-slice-5-social.md`](plans/2026-07-26-mobile-slice-5-social.md) · спека [`2026-07-26-mobile-slice-5-social-design.md`](specs/2026-07-26-mobile-slice-5-social-design.md)
- **26.07** — Срез 4 — таблицы админки — план [`2026-07-26-mobile-slice-4-tables.md`](plans/2026-07-26-mobile-slice-4-tables.md) · спека [`2026-07-26-mobile-slice-4-tables-design.md`](specs/2026-07-26-mobile-slice-4-tables-design.md)
- **26.07** — Срез 3 — контентные экраны — план [`2026-07-26-mobile-slice-3-content-screens.md`](plans/2026-07-26-mobile-slice-3-content-screens.md) · спека [`2026-07-26-mobile-slice-3-content-screens-design.md`](specs/2026-07-26-mobile-slice-3-content-screens-design.md)
- **26.07** — Срез 2 — плеер — план [`2026-07-26-mobile-slice-2-player.md`](plans/2026-07-26-mobile-slice-2-player.md) · спека [`2026-07-26-mobile-slice-2-player-design.md`](specs/2026-07-26-mobile-slice-2-player-design.md)
- **25.07** — Срез 1 — действия над треком — план [`2026-07-25-mobile-slice-1-track-actions.md`](plans/2026-07-25-mobile-slice-1-track-actions.md) · спека [`2026-07-25-mobile-slice-1-track-actions-design.md`](specs/2026-07-25-mobile-slice-1-track-actions-design.md)
- **22.07** — Срез 0 — фундамент: bottom-sheet-ядро, `AdaptiveMenu`, тач-таргеты — план [`2026-07-22-mobile-slice-0-foundation.md`](plans/2026-07-22-mobile-slice-0-foundation.md) · спека [`2026-07-22-mobile-slice-0-foundation-design.md`](specs/2026-07-22-mobile-slice-0-foundation-design.md)
- **22.07** — Программа работ — декомпозиция на срезы 0–7 — спека [`2026-07-22-mobile-first-program.md`](specs/2026-07-22-mobile-first-program.md)

## VireGlass

Материал «жидкое стекло» на Android. Текущее состояние и решения — `docs/vireglass/README.md`, `architecture.md`, `ADR-001-rendering-architecture.md`.

- **30.08** — Своя подложка вместо чужого захвата (физическая модель v4) — план [`2026-08-30-vireglass-own-backdrop.md`](plans/2026-08-30-vireglass-own-backdrop.md) · спека [`2026-08-30-vireglass-v4-physical-model.md`](specs/2026-08-30-vireglass-v4-physical-model.md)
- **29.08** — Материал v1 — модель на причинах (ior/толщина/фаска/шероховатость/плёнка) — план [`2026-08-29-vireglass-material-v1.md`](plans/2026-08-29-vireglass-material-v1.md) · спека [`2026-08-29-vireglass-material-v1.md`](specs/2026-08-29-vireglass-material-v1.md)

## Джем и вечеринка

Общая очередь по коду/QR (джем) и её скрытый режим с внешними треками (вечеринка). Текущее состояние — `docs/features/jam.md`, `docs/features/party.md`.

- **03.08** — Вечеринка — юзабилити-проход (экран, визуализатор, мобильный поиск, ссылки) — план [`2026-08-03-party-usability-design.md`](plans/2026-08-03-party-usability-design.md)
- **02.08** — Вечеринка, срез D — «вечериночное» полировка — план [`2026-08-02-party-slice-d-vecherinochnoe.md`](plans/2026-08-02-party-slice-d-vecherinochnoe.md)
- **02.08** — Вечеринка, срез C — поверхности — план [`2026-08-02-party-slice-c-surfaces.md`](plans/2026-08-02-party-slice-c-surfaces.md)
- **02.08** — Вечеринка, срез B — резолвер внешних ссылок — план [`2026-08-02-party-slice-b-resolver.md`](plans/2026-08-02-party-slice-b-resolver.md)
- **01.08** — Джем — единая глобальная сессия — план [`2026-08-01-jam-global-session.md`](plans/2026-08-01-jam-global-session.md) · спека [`2026-08-01-jam-global-session-design.md`](specs/2026-08-01-jam-global-session-design.md)
- **01.08** — Вечеринка — дизайн секретного режима джема с внешними треками — спека [`2026-08-01-party-mode-design.md`](specs/2026-08-01-party-mode-design.md)
- **01.08** — Вечеринка, срез A — домен — план [`2026-08-01-party-slice-a-domain.md`](plans/2026-08-01-party-slice-a-domain.md)
- **29.07** — Джем — режимы — план [`2026-07-29-jam-modes.md`](plans/2026-07-29-jam-modes.md) · спека [`2026-07-29-jam-modes-design.md`](specs/2026-07-29-jam-modes-design.md)
- **29.07** — Джем — переработка дрейфа синхронизации — план [`2026-07-29-jam-drift-rework.md`](plans/2026-07-29-jam-drift-rework.md)
- **29.07** — Джем — пачка багфиксов — план [`2026-07-29-jam-bugfix-batch.md`](plans/2026-07-29-jam-bugfix-batch.md) · спека [`2026-07-29-jam-bugfix-batch-design.md`](specs/2026-07-29-jam-bugfix-batch-design.md)
- **27.07** — Джем — аудио-оверлеи, мобильный бэклог — план [`2026-07-27-jam-audio-overlays-mobile-backlog.md`](plans/2026-07-27-jam-audio-overlays-mobile-backlog.md) · спека [`2026-07-27-jam-audio-overlays-mobile-backlog-design.md`](specs/2026-07-27-jam-audio-overlays-mobile-backlog-design.md)
- **21.07** — Джем-чат — качество — план [`2026-07-21-jam-chat-quality.md`](plans/2026-07-21-jam-chat-quality.md) · спека [`2026-07-21-jam-chat-quality.md`](specs/2026-07-21-jam-chat-quality.md)
- **21.07** — Джем-чат — фиксы — план [`2026-07-21-jam-chat-fixes-plan.md`](plans/2026-07-21-jam-chat-fixes-plan.md) · спека [`2026-07-21-jam-chat-fixes.md`](specs/2026-07-21-jam-chat-fixes.md)
- **20.07** — Джем — базовые сессии — план [`2026-07-20-jam-sessions.md`](plans/2026-07-20-jam-sessions.md) · спека [`2026-07-20-jam-sessions-design.md`](specs/2026-07-20-jam-sessions-design.md)

## Соцслой: друзья, чат, уведомления

Дружба, E2EE-чат 1:1, колокольчик уведомлений. Текущее состояние — `docs/features/social-friends.md`, `docs/features/chat.md`, `docs/features/notifications.md`.

- **03.08** — Чат — фикс — план [`2026-08-03-chat-fix-plan.md`](plans/2026-08-03-chat-fix-plan.md)
- **20.07** — E2EE/уведомления — хвосты — план [`2026-07-20-e2ee-notify-tails.md`](plans/2026-07-20-e2ee-notify-tails.md)
- **20.07** — Чат/E2EE/профиль/пуши — фиксы — план [`2026-07-20-chat-e2ee-profile-push-fixes.md`](plans/2026-07-20-chat-e2ee-profile-push-fixes.md) · спека [`2026-07-20-chat-e2ee-profile-push-fixes.md`](specs/2026-07-20-chat-e2ee-profile-push-fixes.md)
- **19.07** — Доставка и обнаруживаемость уведомлений — план [`2026-07-19-notification-delivery-discoverability.md`](plans/2026-07-19-notification-delivery-discoverability.md) · спека [`2026-07-19-notification-delivery-discoverability-design.md`](specs/2026-07-19-notification-delivery-discoverability-design.md)
- **19.07** — E2EE-чат — базовая реализация — план [`2026-07-19-e2ee-chat.md`](plans/2026-07-19-e2ee-chat.md) · спека [`2026-07-19-e2ee-chat-design.md`](specs/2026-07-19-e2ee-chat-design.md)
- **18.07** — Соц/поиск/уведомления — вынос логики в core — спека [`2026-07-18-social-search-notifications-core-purity.md`](specs/2026-07-18-social-search-notifications-core-purity.md)
- **18.07** — Соцслой, срез 2 — план [`2026-07-18-social-slice2.md`](plans/2026-07-18-social-slice2.md) · спека [`2026-07-18-social-slice2-design.md`](specs/2026-07-18-social-slice2-design.md)
- **18.07** — Соцслой — дружба, срез 1 — план [`2026-07-18-social-friends.md`](plans/2026-07-18-social-friends.md) · спека [`2026-07-18-social-friends-design.md`](specs/2026-07-18-social-friends-design.md)

## Плеер и волна

Плеер и алгоритм рекомендаций «Волна». Текущее состояние — `docs/features/player.md`, `docs/features/wave.md`.

- **02.08** — Локальные файлы в глобальном плеере — план [`2026-08-02-local-files-global-player.md`](plans/2026-08-02-local-files-global-player.md)
- **02.08** — Профиль вкуса — сигнал Last.fm — план [`2026-08-02-lastfm-taste.md`](plans/2026-08-02-lastfm-taste.md)
- **12.07** — Волна — материализация профиля вкуса — план [`2026-07-12-wave-taste-materialization.md`](plans/2026-07-12-wave-taste-materialization.md) · спека [`2026-07-12-wave-taste-materialization-design.md`](specs/2026-07-12-wave-taste-materialization-design.md)
- **10.07** — Отображение трека и скролл текста — план [`2026-07-10-track-display-and-lyrics-scroll.md`](plans/2026-07-10-track-display-and-lyrics-scroll.md) · спека [`2026-07-10-track-display-and-lyrics-scroll.md`](specs/2026-07-10-track-display-and-lyrics-scroll.md)
- **04.07** — Плеер — повтор, техдолг — план [`2026-07-04-player-repeat-and-debt.md`](plans/2026-07-04-player-repeat-and-debt.md)
- **03.07** — Переработка воспроизведения и рексис — план [`2026-07-03-playback-recsys-rework.md`](plans/2026-07-03-playback-recsys-rework.md) · спека [`2026-07-03-playback-recsys-rework-design.md`](specs/2026-07-03-playback-recsys-rework-design.md)

## Главная и лента

Контент-хаб `/`, ранжирование секции «Ваша лента», discovery. Текущее состояние — `docs/features/home-feed.md`, `docs/features/feed.md`, `docs/features/discovery.md`, `docs/features/curated-playlists.md`.

- **28.07** — Discovery через людей и вкус — план [`2026-07-28-discovery-people-taste.md`](plans/2026-07-28-discovery-people-taste.md) · спека [`2026-07-28-discovery-people-taste-design.md`](specs/2026-07-28-discovery-people-taste-design.md)
- **28.07** — Модель состава и ранжирование ленты — план [`2026-07-28-feed-model-and-ranking.md`](plans/2026-07-28-feed-model-and-ranking.md) · спека [`2026-07-28-feed-model-and-ranking-design.md`](specs/2026-07-28-feed-model-and-ranking-design.md)
- **17.07** — Редакционное качество подборок — план [`2026-07-17-editorial-quality.md`](plans/2026-07-17-editorial-quality.md) · спека [`2026-07-17-editorial-quality-design.md`](specs/2026-07-17-editorial-quality-design.md)
- **14.07** — Теги «Потока» и текучие рельсы (ScrollRow) — план [`2026-07-14-flow-tags-and-fluid-rails-plan.md`](plans/2026-07-14-flow-tags-and-fluid-rails-plan.md) · спека [`2026-07-14-flow-tags-and-fluid-rails-design.md`](specs/2026-07-14-flow-tags-and-fluid-rails-design.md)
- **13.07** — Полировка главной — план [`2026-07-13-homepage-polish.md`](plans/2026-07-13-homepage-polish.md) · спека [`2026-07-13-homepage-polish-design.md`](specs/2026-07-13-homepage-polish-design.md)
- **13.07** — Отложенная пачка правок главной — план [`2026-07-13-homepage-deferred-batch.md`](plans/2026-07-13-homepage-deferred-batch.md) · спека [`2026-07-13-homepage-deferred-batch-design.md`](specs/2026-07-13-homepage-deferred-batch-design.md)
- **05.07** — Джиттер строк на главной — разбор и фикс — спека [`2026-07-05-home-jitter-rows.md`](specs/2026-07-05-home-jitter-rows.md)
- **02.07** — Редизайн главной/ленты — план [`2026-07-02-homepage-feed-redesign.md`](plans/2026-07-02-homepage-feed-redesign.md) · спека [`2026-07-02-homepage-feed-redesign-design.md`](specs/2026-07-02-homepage-feed-redesign-design.md)

## Артист, релиз, профиль слушателя

Профиль артиста, страница релиза/трека, оболочка и профиль слушателя. Текущее состояние — `docs/features/artist-profile.md`, `docs/features/tracks-and-releases.md`, `docs/features/listener-shell.md`, `docs/features/listener-profile.md`.

- **12.07** — Пустой артист — 404 — план [`2026-07-12-empty-artist-404.md`](plans/2026-07-12-empty-artist-404.md) · спека [`2026-07-12-empty-artist-404-design.md`](specs/2026-07-12-empty-artist-404-design.md)
- **02.07** — Редизайн профиля слушателя — спека [`2026-07-02-profile-redesign-design.md`](specs/2026-07-02-profile-redesign-design.md)
- **01.07** — Редизайн релиза и трека — план [`2026-07-01-release-track-redesign.md`](plans/2026-07-01-release-track-redesign.md) · спека [`2026-07-01-release-track-redesign-design.md`](specs/2026-07-01-release-track-redesign-design.md)
- **30.06** — Редизайн страницы артиста, v2 — план [`2026-06-30-artist-page-redesign-v2.md`](plans/2026-06-30-artist-page-redesign-v2.md) · спека [`2026-06-30-artist-page-redesign-v2-design.md`](specs/2026-06-30-artist-page-redesign-v2-design.md)
- **30.06** — Редизайн страницы артиста, v1 — план [`2026-06-30-artist-page-redesign.md`](plans/2026-06-30-artist-page-redesign.md) · спека [`2026-06-30-artist-page-redesign-design.md`](specs/2026-06-30-artist-page-redesign-design.md)
- **28.06** — Оболочка-дашборд слушателя (сайдбар, Spotify-модель) — план [`2026-06-28-listener-dashboard-shell.md`](plans/2026-06-28-listener-dashboard-shell.md) · спека [`2026-06-28-listener-dashboard-shell-design.md`](specs/2026-06-28-listener-dashboard-shell-design.md) · фиксы [`listener-shell-layout-fixes.md`](specs/listener-shell-layout-fixes.md)

## Плейлисты

Текущее состояние — `docs/features/playlists.md`.

- **28.07** — Совместные плейлисты — план [`2026-07-28-collaborative-playlists.md`](plans/2026-07-28-collaborative-playlists.md) · спека [`2026-07-28-collaborative-playlists-design.md`](specs/2026-07-28-collaborative-playlists-design.md)
- **14.07** — Обложки и шеринг плейлистов — план [`2026-07-14-playlist-covers-and-sharing-plan.md`](plans/2026-07-14-playlist-covers-and-sharing-plan.md) · спека [`2026-07-14-playlist-covers-and-sharing-design.md`](specs/2026-07-14-playlist-covers-and-sharing-design.md)
- **04.07** — Лайки плейлистов и описание — план [`2026-07-04-playlist-likes-and-about.md`](plans/2026-07-04-playlist-likes-and-about.md)
- **28.06** — Управление плейлистами — база — план [`2026-06-28-playlist-management.md`](plans/2026-06-28-playlist-management.md) · спека [`2026-06-28-playlist-management-design.md`](specs/2026-06-28-playlist-management-design.md)

## Дашборд и админка

Текущее состояние — `docs/features/dashboard.md`, `docs/features/admin.md`.

- **17.07** — Хвосты админки + прогресс «чёрного неба» (пасхалка) — план [`2026-07-17-admin-tails-blacksky-plan.md`](plans/2026-07-17-admin-tails-blacksky-plan.md) · спека [`2026-07-17-admin-tails-blacksky-design.md`](specs/2026-07-17-admin-tails-blacksky-design.md)

## Десктоп-клиент

Tauri v2 оболочка. Текущее состояние — `docs/features/desktop-app.md`.

- **17.08** — Мини-плеер поверх других окон — план [`2026-08-17-desktop-mini-player.md`](plans/2026-08-17-desktop-mini-player.md) · спека [`2026-08-17-desktop-mini-player-design.md`](specs/2026-08-17-desktop-mini-player-design.md)
- **16.08** — Раздача: `/download`, GitHub Release, публичный MinIO — план [`2026-08-16-desktop-download-distribution.md`](plans/2026-08-16-desktop-download-distribution.md) · спека [`2026-08-16-desktop-download-distribution-design.md`](specs/2026-08-16-desktop-download-distribution-design.md)
- **16.08** — Срез 7 — план [`2026-08-16-desktop-shell-slice-7.md`](plans/2026-08-16-desktop-shell-slice-7.md) · спека [`2026-08-16-desktop-shell-slice-7-design.md`](specs/2026-08-16-desktop-shell-slice-7-design.md)
- **16.08** — Срез 6 — план [`2026-08-16-desktop-shell-slice-6.md`](plans/2026-08-16-desktop-shell-slice-6.md) · спека [`2026-08-16-desktop-shell-slice-6-design.md`](specs/2026-08-16-desktop-shell-slice-6-design.md)
- **16.08** — Срез 5 — план [`2026-08-16-desktop-shell-slice-5.md`](plans/2026-08-16-desktop-shell-slice-5.md) · спека [`2026-08-16-desktop-shell-slice-5-design.md`](specs/2026-08-16-desktop-shell-slice-5-design.md)
- **16.08** — Срез 4 — план [`2026-08-16-desktop-shell-slice-4.md`](plans/2026-08-16-desktop-shell-slice-4.md) · спека [`2026-08-16-desktop-shell-slice-4-design.md`](specs/2026-08-16-desktop-shell-slice-4-design.md)
- **16.08** — Срез 3 — план [`2026-08-16-desktop-shell-slice-3.md`](plans/2026-08-16-desktop-shell-slice-3.md) · спека [`2026-08-16-desktop-shell-slice-3-design.md`](specs/2026-08-16-desktop-shell-slice-3-design.md)
- **16.08** — Срез 2 — план [`2026-08-16-desktop-shell-slice-2.md`](plans/2026-08-16-desktop-shell-slice-2.md) · спека [`2026-08-16-desktop-shell-slice-2-design.md`](specs/2026-08-16-desktop-shell-slice-2-design.md)
- **16.08** — Срез 1 — план [`2026-08-16-desktop-shell-slice-1.md`](plans/2026-08-16-desktop-shell-slice-1.md) · спека [`2026-08-16-desktop-shell-slice-1-design.md`](specs/2026-08-16-desktop-shell-slice-1-design.md)
- **16.08** — Срез 0 — window shell, tray, media keys — план [`2026-08-16-desktop-shell-slice-0.md`](plans/2026-08-16-desktop-shell-slice-0.md) · спека [`2026-08-16-desktop-shell-slice-0-design.md`](specs/2026-08-16-desktop-shell-slice-0-design.md)

## Platform Core: рефакторинг ядра и read-path

Волна вынесения бизнес-логики в `packages/core` и перевода чтения на query-функции по заданию из `docs/roadmap/platform-core-brief.md`. Текущие границы слоёв — `docs/foundation/architecture.md`, `docs/platform-core.md`.

- **16.08** — Волна 7 — env через zod, реестры типов/событий уведомлений, feature flags — план [`2026-08-16-notifications-config-wave7.md`](plans/2026-08-16-notifications-config-wave7.md) · спека [`2026-08-16-notifications-config-wave7.md`](specs/2026-08-16-notifications-config-wave7.md)
- **12.08** — Волна 5 — чистая логика в core — план [`2026-08-12-pure-logic-wave5.md`](plans/2026-08-12-pure-logic-wave5.md) · спека [`2026-08-12-pure-logic-wave5.md`](specs/2026-08-12-pure-logic-wave5.md)
- **12.08** — Волна 3 — контракты `@vire/api-contracts` — план [`2026-08-12-api-contracts-wave3.md`](plans/2026-08-12-api-contracts-wave3.md) · спека [`2026-08-12-api-contracts-wave3.md`](specs/2026-08-12-api-contracts-wave3.md)
- **11.08** — Read-path — блоки главной — спека [`2026-08-11-read-path-home-blocks.md`](specs/2026-08-11-read-path-home-blocks.md)
- **11.08** — Read-path — лента — спека [`2026-08-11-read-path-feed.md`](specs/2026-08-11-read-path-feed.md)
- **11.08** — Read-path — каталог релизов — план [`2026-08-11-read-path-release-catalog.md`](plans/2026-08-11-read-path-release-catalog.md) · спека [`2026-08-11-read-path-release-catalog.md`](specs/2026-08-11-read-path-release-catalog.md)
- **11.08** — Read-path — релиз — план [`2026-08-11-read-path-release.md`](plans/2026-08-11-read-path-release.md) · спека [`2026-08-11-read-path-release.md`](specs/2026-08-11-read-path-release.md)
- **11.08** — Read-path — плейлист — план [`2026-08-11-read-path-playlist.md`](plans/2026-08-11-read-path-playlist.md) · спека [`2026-08-11-read-path-playlist.md`](specs/2026-08-11-read-path-playlist.md)
- **11.08** — Read-path — каталог артистов — план [`2026-08-11-read-path-artist-catalog.md`](plans/2026-08-11-read-path-artist-catalog.md) · спека [`2026-08-11-read-path-artist-catalog.md`](specs/2026-08-11-read-path-artist-catalog.md)
- **11.08** — Read-path — артист — план [`2026-08-11-read-path-artist.md`](plans/2026-08-11-read-path-artist.md) · спека [`2026-08-11-read-path-artist.md`](specs/2026-08-11-read-path-artist.md)
- **11.08** — RBAC — единая матрица прав `platform/access` — план [`2026-08-11-platform-access-rbac.md`](plans/2026-08-11-platform-access-rbac.md) · спека [`2026-08-11-platform-access-rbac.md`](specs/2026-08-11-platform-access-rbac.md)
- **28.07** — Шардирование sitemap — план [`2026-07-28-sitemap-sharding.md`](plans/2026-07-28-sitemap-sharding.md) · спека [`2026-07-28-sitemap-sharding-design.md`](specs/2026-07-28-sitemap-sharding-design.md)
- **17.07** — JWT-рефреш и рейтлимит анлайка — спека [`2026-07-17-jwt-refresh-and-unlike-ratelimit-design.md`](specs/2026-07-17-jwt-refresh-and-unlike-ratelimit-design.md)
- **17.07** — Чистка core и мета-описания — спека [`2026-07-17-core-cleanup-and-meta-descriptions.md`](specs/2026-07-17-core-cleanup-and-meta-descriptions.md)
- **13.07** — Server actions — вынос в core — спека [`2026-07-13-server-actions-core-design.md`](specs/2026-07-13-server-actions-core-design.md)
- **13.07** — Остаток тестов роут-хендлеров — спека [`2026-07-13-route-tests-remainder-design.md`](specs/2026-07-13-route-tests-remainder-design.md)
- **13.07** — Покупка — вынос логики в core (Этап 2) — спека [`2026-07-13-purchase-core-design.md`](specs/2026-07-13-purchase-core-design.md)
- **13.07** — Производительность бандла — спека [`2026-07-13-bundle-perf-design.md`](specs/2026-07-13-bundle-perf-design.md)
- **12.07** — Волна/поиск/пресейв — вынос в core — спека [`2026-07-12-wave-search-presave-core-design.md`](specs/2026-07-12-wave-search-presave-core-design.md)
- **12.07** — Взаимодействия слушателя — вынос в core — спека [`2026-07-12-listener-interactions-core-design.md`](specs/2026-07-12-listener-interactions-core-design.md)
- **12.07** — Дашборд — вынос в core — спека [`2026-07-12-dashboard-core-design.md`](specs/2026-07-12-dashboard-core-design.md)
- **12.07** — Нарезка рефакторинга Этапа 2 на срезы — спека [`2026-07-12-stage2-refactor-slicing-design.md`](specs/2026-07-12-stage2-refactor-slicing-design.md)
- **10.07** — Индексы БД и оптимистичный тоггл — план [`2026-07-10-db-indexes-and-optimistic-toggle.md`](plans/2026-07-10-db-indexes-and-optimistic-toggle.md) · спека [`2026-07-10-db-indexes-and-optimistic-toggle.md`](specs/2026-07-10-db-indexes-and-optimistic-toggle.md)

## Дизайн-система и токены

Текущее состояние — `docs/features/design-system.md`, `docs/features/design-tokens.md`.

- **16.08** — Экспорт дизайн-токенов (`packages/design-tokens`) — план [`2026-08-16-design-tokens-export.md`](plans/2026-08-16-design-tokens-export.md) · спека [`2026-08-16-design-tokens-export-design.md`](specs/2026-08-16-design-tokens-export-design.md)
- **08.08** — Типографика дизайн-системы — план [`2026-08-08-design-system-typography-plan.md`](plans/2026-08-08-design-system-typography-plan.md) · спека [`2026-08-08-design-system-typography-design.md`](specs/2026-08-08-design-system-typography-design.md)

## Локализация

Текущее состояние — `docs/features/i18n.md`.

- **09.08** — Полная локализация ru/en — план [`2026-08-09-i18n-full-localization-plan.md`](plans/2026-08-09-i18n-full-localization-plan.md) · спека [`2026-08-09-i18n-full-localization-design.md`](specs/2026-08-09-i18n-full-localization-design.md)

## Каталог и жанры

- **06.07** — Расширение списка жанров — план [`2026-07-06-genre-expansion.md`](plans/2026-07-06-genre-expansion.md) · спека [`2026-07-06-genre-expansion-design.md`](specs/2026-07-06-genre-expansion-design.md)

## PWA и офлайн

Текущее состояние — `docs/features/pwa-offline.md`.

- **03.08** — Установка, кэш оболочки, скачивание треков — план [`2026-08-03-pwa-offline-plan.md`](plans/2026-08-03-pwa-offline-plan.md) · спека [`2026-08-03-pwa-offline-design.md`](specs/2026-08-03-pwa-offline-design.md)

## QA-хвосты и аудиты бэклога

Пачки исправлений найденного при аудитах и ручном QA-проходе.

- **27.07** — Пачка хвостов бэклога — план [`2026-07-27-backlog-tails.md`](plans/2026-07-27-backlog-tails.md) · спека [`2026-07-27-backlog-tails-design.md`](specs/2026-07-27-backlog-tails-design.md) · ledger [`2026-07-27-backlog-tails-ledger.md`](2026-07-27-backlog-tails-ledger.md)
- **27.07** — Хвосты аудита №2 — og:image, разметка, джем-версии — план [`2026-07-27-audit-tails-2.md`](plans/2026-07-27-audit-tails-2.md) · спека [`2026-07-27-audit-tails-2-design.md`](specs/2026-07-27-audit-tails-2-design.md) · ledger [`2026-07-27-audit-tails-2-ledger.md`](2026-07-27-audit-tails-2-ledger.md)
- **11.07** — Чистка комментариев в коде — план [`2026-07-11-comment-cleanup.md`](plans/2026-07-11-comment-cleanup.md) · спека [`2026-07-11-comment-cleanup.md`](specs/2026-07-11-comment-cleanup.md)
- **11.07** — Мелкие хвосты аудита/бэклога — план [`2026-07-11-audit-backlog-minors.md`](plans/2026-07-11-audit-backlog-minors.md)
- **10.07** — Хвост аудита — план [`2026-07-10-audit-tail.md`](plans/2026-07-10-audit-tail.md) · спека [`2026-07-10-audit-tail.md`](specs/2026-07-10-audit-tail.md)
- **05.07** — QA — фиксы найденного — план [`2026-07-05-qa-batch-fixes.md`](plans/2026-07-05-qa-batch-fixes.md)
- **05.07** — QA-пачка 1–13 — план [`2026-07-05-qa-batch-1-13.md`](plans/2026-07-05-qa-batch-1-13.md) · спека [`2026-07-05-qa-batch-1-13.md`](specs/2026-07-05-qa-batch-1-13.md)
- **05.07** — QA-пачка 1–12 — план [`2026-07-05-qa-batch-1-12.md`](plans/2026-07-05-qa-batch-1-12.md) · спека [`2026-07-05-qa-batch-1-12.md`](specs/2026-07-05-qa-batch-1-12.md)

