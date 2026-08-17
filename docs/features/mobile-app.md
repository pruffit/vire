# Мобильное приложение (инкременты 1–3)

React Native + Expo клиент: auth → навигация → каталог → воспроизведение звука.
Инкремент 1 — дизайн в `docs/superpowers/specs/2026-08-17-mobile-app-increment-1-design.md`;
инкремент 3 (звук) — `docs/superpowers/specs/2026-08-17-mobile-playback-design.md`.

## Что делает

- Таб-бар (native-stack → bottom-tabs): Главная — реальный список свежих релизов с
  `GET /api/v1/releases`, тап по релизу открывает трек-лист (вложенный стек внутри
  таба, см. «Воспроизведение звука» ниже); Профиль — список устройств аккаунта
  (`GET /api/v1/auth/devices`), отзыв чужого устройства, выход (отзыв текущего + очистка
  secure store); Поиск/Медиатека — честные заглушки-стабы («Скоро»), не притворяются
  функциональными.
- **Воспроизведение звука (инкремент 3).** Экран релиза (`GET /api/v1/releases/{id}`) —
  трек-лист с длительностью, недоступные (не `READY`) треки некликабельны. Тап по треку
  запускает весь трек-лист релиза как очередь через zustand-стор (`lib/player-store.ts`),
  который переиспользует чистые функции очереди из `@vire/core` (`nextQueueIndex` и т.п.,
  та же логика, что и в вебе) и грузит HLS-манифест трека
  (`GET /api/v1/tracks/{id}/manifest`, публичный роут). Мини-плеер — над таб-баром, когда
  очередь не пуста (обложка, название/артист, play/pause, тап открывает полный плеер).
  Полный плеер — модальный экран поверх корневого стека: крупная обложка, транспорт
  prev/play-pause/next, кастомный слайдер позиции (`PanResponder`, без сторонних нативных
  зависимостей) с реальной перемоткой через `seek()`. Библиотека — `expo-audio` (не
  `react-native-track-player`, см. обоснование в спеке инкремента 3): работает в обычном
  Expo Go и имеет веб-реализацию, что и позволяет проверять поверх `expo start --web`.
  Shuffle/repeat, оффлайн, лайки/плейлисты из мобилки — вне скоупа (см. ниже).
- Экран входа: `expo-web-browser` открывает `/mobile-auth-bridge` в изолированной
  системной сессии (`openAuthSessionAsync`, не `<WebView>` — пароль вводится вне контекста
  приложения), редирект `vire://auth-callback?accessToken&refreshToken&deviceId` разбирается
  `expo-linking`, токены — в `expo-secure-store`. При старте с уже сохранёнными токенами
  экран входа пропускается.
- Тёмная тема, цвета из `packages/design-tokens` (OKLCH → hex на этапе генерации — RN не
  ест `oklch()` в JS).

## Где код

- **Веб-мост входа:** `apps/web/app/mobile-auth-bridge/page.tsx` + `layout.tsx` — тот же
  core-сервис, что `POST /api/v1/auth/devices` (`docs/features/device-auth.md`); гейт в
  `apps/web/proxy.ts` (`UNLOCALIZED_PREFIXES`).
- **Пакет:** `apps/mobile/` (`@vire/mobile`, Expo managed + TS).
  - `App.tsx`, `index.ts` — точка входа.
  - `navigation/root-navigator.tsx` — native-stack (SignIn/Main/Player-модалка), решение о
    стартовом экране по наличию токенов в secure store.
  - `navigation/main-tabs.tsx` — bottom-tabs, 4 вкладки; таб «Главная» — не экран напрямую,
    а `HomeStackNavigator` (`navigation/home-stack.tsx`), вложенный native-stack
    `HomeList → ReleaseDetail` внутри таба (таб-бар не пропадает — стандартный паттерн
    вложенных навигаторов).
  - `navigation/main-screen.tsx` — обёртка `MainTabs` + `MiniPlayer` (мини-плеер рисуется
    поверх таб-бара как оверлей, не элемент вкладки).
  - `screens/sign-in-screen.tsx`, `screens/home-screen.tsx`, `screens/profile-screen.tsx`,
    `screens/release-screen.tsx` (трек-лист релиза, тап запускает очередь),
    `screens/player-screen.tsx` (полноэкранный модальный плеер) — рабочие экраны.
  - `screens/{search,library}-screen.tsx` + `components/stub-screen.tsx` — заглушки.
  - `components/mini-player.tsx` — мини-бар над таб-баром.
  - `lib/env.ts` — `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_BASE_URL`, фолбэк localhost:3000.
  - `lib/secure-store.ts` — обёртка над `expo-secure-store` (accessToken/refreshToken/deviceId).
    На web `expo-secure-store` не реализован вообще (`getValueWithKeyAsync` отсутствует,
    падает синхронно) — обёртка фолбэчит на `localStorage` при `Platform.OS==='web'` (только
    для `expo start --web`; Expo Go/нативные сборки используют настоящий Keychain/Keystore).
    `root-navigator.tsx` также ловит отказ `hasStoredSession()` в `.catch()` — без него
    web-превью зависал на спиннере навсегда.
  - `lib/api-client.ts` — `apiRequest()`: Bearer из secure store + один повтор через
    `POST /api/v1/auth/refresh` на 401. Первый реальный вызывающий — `profile-screen.tsx`
    (список/отзыв устройств); Главная по-прежнему бьёт в публичный `/api/v1/releases`
    напрямую через `request()` из `@vire/api-client` (не нужен Bearer).
  - `lib/audio-engine.ts` — `ExpoAudioEngine implements IAudioEngine` (`@vire/core/playback/audio-engine`)
    поверх `expo-audio`: один переиспользуемый `AudioPlayer` (`createAudioPlayer`), `load()`
    подменяет источник через `replace()` и резолвится по `playbackStatusUpdate.isLoaded`;
    `didJustFinish`/`isBuffering`-edge/`error` маппятся в `ended`/`stalled`/`error`.
  - `lib/player-store.ts` — zustand-стор (`queue`/`queueIndex`/`status`/`positionSec`/
    `durationSec`), транспорт через `nextQueueIndex` из `@vire/core/playback/queue` (та же
    логика очереди, что и в вебе, не переписана). Гонки: если `queueIndex` сменился, пока
    летел запрос манифеста, устаревший ответ отбрасывается; если `audioEngine.load()`
    отклоняется — статус `error`, а не бесконечный `loading`.
  - `lib/format.ts` — `formatDuration()` (m:ss) для трек-листа и полного плеера.
  - `lib/theme.ts` — реэкспорт `@vire/design-tokens/native`.
  - `metro.config.js` — монорепо: `watchFolders` на корень репозитория,
    `unstable_enablePackageExports` (для `@vire/design-tokens/native`). **Без
    `disableHierarchicalLookup`/кастомного `nodeModulesPaths`** — в отличие от типового
    Yarn/npm-гайда Expo для монорепо, pnpm резолвит транзитивные зависимости
    (`expo-modules-core` и т.п.) через вложенные `node_modules` внутри `.pnpm`-хранилища,
    и hierarchical lookup обязателен.
- **RN-таргет токенов:** `packages/design-tokens/src/generate.ts` — `oklchToHex()` (чистая
  конвертация OKLCH→OKLab→linear sRGB→gamma sRGB→hex, формулы Björn Ottosson, без внешних
  зависимостей) и `generateNative()`; `scripts/build.mjs` пишет `dist/tokens.native.ts`;
  `exports["./native"]` в `package.json`.
- **`packages/core/package.json`:** новые подпути `./playback/queue` и `./playback/audio-engine`
  (рядом с уже существующими `./access`/`./signing`) — баррель `@vire/core` тянет
  `notifications/email-templates` → `@vire/i18n`, чей `messages.ts` грузит локали
  динамическим `import()` от рантайм-строки; Metro (в отличие от Next.js/tsc) это не
  резолвит статически и валит весь мобильный бандл. `apps/mobile` импортирует очередь и
  порт только через эти подпути, не через баррель.
- **`apps/mobile/app.json`:** плагин `expo-audio` с опциями
  `{ microphonePermission: false, recordAudioAndroid: false }` — сам плагин безусловно
  запрашивает разрешение на микрофон (нужно только для записи, которой в приложении нет),
  опции его отключают. Фоновое воспроизведение (`UIBackgroundModes: audio` на iOS,
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` на Android) включено дефолтом плагина
  (`enableBackgroundPlayback: true`) — отдельно настраивать не пришлось.
- **`@vire/api-client`:** `packages/api-client/src/http.ts` — `RequestOptions.headers?`
  мёржится в fetch-заголовки, не перетирая `Content-Type`.
- **`packages/config/package.json`:** добавлен явный `devDependencies.typescript` —
  без него pnpm резолвил peer `typescript` для `typescript-eslint` неоднозначно (разные
  версии TS в разных углах монорепо после появления `apps/mobile`), и получались два разных
  экземпляра `typescript-eslint@8.60.1` с разными плагин-инстансами — `eslint` в
  `apps/web` падал `ConfigError: Cannot redefine plugin "@typescript-eslint"`. Пин делает
  peer-резолюцию детерминированной независимо от того, какую версию TS тянут остальные
  пакеты монорепо.

## Как запустить

```bash
pnpm --filter @vire/mobile mobile:web       # expo start --web — react-native-web в браузере
pnpm --filter @vire/mobile mobile:start     # expo start — QR для Expo Go
pnpm --filter @vire/mobile mobile:android   # expo start --android — нужен эмулятор/устройство
```

Веб-мост входа и API нужен реальный `pnpm --filter @vire/web dev` на 3000.

## Env

- `EXPO_PUBLIC_API_BASE_URL` — базовый URL API, фолбэк `http://localhost:3000`.
- `EXPO_PUBLIC_WEB_BASE_URL` — базовый URL веб-моста входа, фолбэк `http://localhost:3000`.

## Проверено в инкременте 1

- `npx expo start --web`: Metro поднимается без ошибок бандлинга, `GET /` отдаёт HTML с
  `<title>VireMusic</title>`, JS-бандл (`/apps/mobile/index.ts.bundle?platform=web...`)
  компилируется в 200 (~3.2 МБ) и содержит реальные строки кода (URL `/api/v1/releases`,
  `/api/v1/auth/devices`, hex-цвета темы, `vire://auth-callback`, ярлыки вкладок, тексты
  экрана «Устройства») — подтверждено `grep` по скомпилированному бандлу.
- `GET /api/v1/releases?sort=fresh&limit=24` на реальном `pnpm --filter @vire/web dev` —
  200, реальные 2 релиза из локальной БД (не заглушка).
- `mobile-auth-bridge` без cookie-сессии — `307` → `/sign-in?callbackUrl=/mobile-auth-bridge`
  (проверено `curl` на реальном dev-сервере). **Авторизованная ветка (реальный
  `vire://auth-callback?accessToken=...`, и следом реальный список устройств на экране
  «Профиль») по-прежнему не проверена end-to-end** — в локальной БД нет пользователя с
  паролем (единственный юзер вошёл через OAuth/magic-link). Код прочитан целиком и
  соответствует контракту `deviceAuthService().register()`/`.list()`/`.revoke()`; реальный
  клик через `openAuthSessionAsync` в принципе не воспроизводим в `expo start --web` (это
  нативный API системного браузера) — первая настоящая проверка обеих веток входа и экрана
  «Профиль» произойдёт при первом запуске через Expo Go на реальном телефоне.
- Все гейты веба (`typecheck`/`lint`/`check:routes`/`check:i18n`/`check:contracts`/`test`/
  `build`) и `apps/mobile`/`packages/design-tokens`/`packages/api-client` — зелёные.
- `apps/mobile` получил тестовый раннер (`vitest`, `test`/`test:watch`, конфиг как у
  `packages/api-client` — plain node environment, RN-рендеринг не нужен). 7 тестов на
  `apiRequest()` (`lib/__tests__/api-client.test.ts`): Bearer из store, отсутствие токена,
  успех без рефреша, 401→рефреш→повтор с новым токеном, неудачный рефреш → очистка токенов
  без повтора, отсутствие `refreshToken` → рефреш не вызывается, single-flight на два
  конкурентных 401 (диспетчер мока по URL, не по порядку вызовов — порядок реальных
  конкурентных микротасков не детерминирован).

## Проверено в инкременте 3 (звук)

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (35 тестов: `player-store.test.ts`
  на переходы очереди с замоканным `audio-engine.ts` — playQueue/next/prev, устаревший ответ
  манифеста при быстром next/next отбрасывается, `audioEngine.load()` reject → status
  `error`; `audio-engine.test.ts` на реальный класс `ExpoAudioEngine` с замоканным модулем
  `expo-audio` — `replace()`/`seekTo`/статус-маппинг/edge-detection `stalled`/unsubscribe;
  `format.test.ts`). `packages/core typecheck`+`test` (1058 тестов) и `apps/web typecheck` —
  не задеты, зелёные.
- `npx expo start --web` + реальный `pnpm --filter @vire/web dev`: бандл собирается (200,
  ~3.4 МБ), grep подтверждает новый код (`createAudioPlayer`, `playbackStatusUpdate`,
  `seekTo`, `playQueue`, `togglePlayPause`, `ReleaseDetail`, `trackNumber` и т.д.).
- **Звук в вебе — реально проверено и играет.** Драйвером был Playwright (headless Chromium,
  реальный `.pnpm`-инстанс, не MCP): открыт `http://localhost:8081`, пройден путь
  Главная → тап по релизу → тап по треку → мини-плеер → полный плеер, нажаты
  play/pause/next/prev. Свидетельства реального декодирования: позиция росла в реальном
  времени (0:04 → 0:07 за 3 реальных секунды), `duration` совпал с длительностью трека в
  БД, `pause()` останавливал рост позиции (два снимка с разницей 1.5с — позиция не
  изменилась), `next()`/`prev()` корректно переключали трек с правильными
  названием/длительностью, сеть показывала реальные `206 Partial Content` на
  `chunk_000.ts`/`chunk_001.ts`/`chunk_002.ts` (HLS-манифест играет в headless Chromium
  напрямую через `new Audio(m3u8Url)`, отдельного HLS.js-шима не потребовалось).
- Реальное воспроизведение на Android/iOS-устройстве, фоновое воспроизведение при свёрнутом
  приложении, lock-screen/Control Center контролы — **не проверялись** (нет устройства/
  эмулятора на машине разработки). Первая проверка — через Expo Go на телефоне.
- Побочные находки, исправленные по ходу (не архитектурные, но блокировали честную
  веб-проверку — см. правки в `lib/secure-store.ts` и `navigation/root-navigator.tsx` выше):
  `expo-secure-store` не работает на web вообще (не только «недоступен для sensitive-данных»,
  а падает синхронно), и без `.catch()` на `hasStoredSession()` web-превью зависал на
  спиннере навсегда независимо от звука — этот баг блокировал бы честную веб-верификацию
  и прошлых инкрементов, просто раньше его никто не ловил интерактивно.
- Локальная инфраструктура (не код фичи): в этой сессии Postgres/Redis/MinIO по `localhost`
  падали `ECONNRESET` на **любом** запросе с этой машины (воспроизведено даже сырым
  `postgres` клиентом в отдельном скрипте, не только через Next.js) — похоже на баг
  Docker Desktop с port-forwarding по IPv6-loopback (`::1`) после сна хоста; TCP-хендшейк
  проходит, данные — нет. `127.0.0.1` вместо `localhost` в `DATABASE_URL`/`REDIS_URL`/
  `S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT` (`apps/web/.env.local`, не в git) чинит стабильно.
  Если это повторится — тот же фикс.

## Вне скоупа (следующие шаги)

- Shuffle/repeat-UI, оффлайн-скачивание, лайки/добавление в плейлист из мобилки — сами
  функции очереди в `@vire/core` уже есть на будущее, UI сознательно не добавлен.
- Богатые lock-screen/Control Center контролы, Android Auto — специфично для
  `react-native-track-player` (не используется, см. `docs/superpowers/specs/2026-08-17-mobile-playback-design.md`);
  `expo-audio` даёт только базовый `MediaSession`/Now Playing.
- Пуши, диплинки на конкретный трек/релиз.
- iOS-сборка и запуск на реальном устройстве через Expo Go — не проверялись (нет Mac и
  физического телефона на машине разработки); `app.json` пишет конфиг под обе платформы, но
  реально верифицирован только веб-превью (`react-native-web`).
- Android SDK/эмулятор — не установлены и не проверялись (нет `adb`/`java` на машине).
- Реальное устройство: воспроизведение, фоновый режим, lock-screen — первая проверка через
  Expo Go на телефоне (см. «Проверено в инкременте 3» выше).
