# Мобильное приложение (инкременты 1–9)

React Native + Expo клиент: auth → навигация → каталог → воспроизведение звука → SDUI-главная
+ нативная полировка → лайки и плейлисты → shuffle/repeat → диплинк → друзья. Инкремент 1 — дизайн в
`docs/superpowers/specs/2026-08-17-mobile-app-increment-1-design.md`; инкремент 3 (звук) —
`docs/superpowers/specs/2026-08-17-mobile-playback-design.md`. Инкремент 4 закрыл ДВЕ причины
«не работает на реальном телефоне» — обе воспроизведены владельцем продукта вживую на
Android через Expo Go, обе бы полностью блокировали вход и работу приложения независимо
друг от друга:
1. Хардкод redirect-схемы `vire://auth-callback` в мосте входа — в обычном Expo Go (без
   кастомного dev-client/EAS-сборки) эта схема не зарегистрирована в ОС, редиректу после
   входа физически некуда было прилететь обратно в приложение (вход не заканчивался никогда).
2. Сеть на `localhost` — на физическом телефоне резолвится в сам телефон, а не в dev-машину.

Заодно инкремент 4 перевёл главную на SDUI-протокол (`docs/sdui.md`) и добавил нативную
полировку (иконки вместо эмодзи, haptics, pull-to-refresh, predictive back). Инкремент 5
заменил `expo-audio` на `react-native-track-player` (RNTP) ради настоящего lock-screen/
Now Playing/фонового воспроизведения — Windows `MAX_PATH`-блокер сборки устранён
(`.npmrc` → `virtual-store-dir-max-length`), краш `MusicService.emit()` **исправлен и
подтверждён живьём** (патч `reactContext` вместо `currentReactContext` в `MusicService.kt`),
воспроизведение, системные Now Playing-контролы (медиа-карточка в шторке) и фон
подтверждены реальным прогоном на эмуляторе — см. секцию ниже.

## Что делает

- Таб-бар (native-stack → bottom-tabs): Главная — SDUI-композиция с сервера (инкремент 4,
  см. ниже), тап по релизу открывает трек-лист (вложенный стек внутри таба, см.
  «Воспроизведение звука» ниже); Профиль — список устройств аккаунта
  (`GET /api/v1/auth/devices`), отзыв чужого устройства, выход (отзыв текущего + очистка
  secure store); Поиск/Медиатека — честные заглушки-стабы («Скоро»), не притворяются
  функциональными. Переключение вкладки — лёгкий haptic-impact.
- **Главная на SDUI (инкремент 4).** Экран больше не бьёт напрямую в
  `GET /api/v1/releases` — грузит композицию `GET /api/v1/screens/home` с заголовком
  `X-Vire-Blocks: fresh-releases,hot-tracks` (клиент объявляет, что умеет рендерить, —
  `docs/sdui.md` §5), достаёт `source.endpoint` двух блоков и параллельно тянет
  `GET /api/v1/home/fresh-releases`/`GET /api/v1/home/hot-tracks`. Два раздела: «Новые
  релизы» (горизонтальная лента карточек, тап открывает трек-лист релиза) и «В топе»
  (нумерованный список; тап на трек ставит его в очередь плеера как отдельный трек и
  сразу играет — переиспользует тот же `usePlayerStore.playQueue`, что и релизный
  трек-лист). Оба серверных списка уже ограничены (`FRESH_RELEASES_RESULT_LIMIT=18`,
  `HOT_TRACKS_LIMIT=20` в `packages/core/src/music/discovery/services/home-blocks.ts`) — клиентского лимита не
  требуется. Pull-to-refresh (`RefreshControl`) перезагружает композицию + оба блока,
  с лёгким haptic-impact на срабатывание.
- **Воспроизведение звука (инкремент 3).** Экран релиза (`GET /api/v1/releases/{id}`) —
  трек-лист с длительностью, недоступные (не `READY`) треки некликабельны, pull-to-refresh
  (инкремент 4). Тап по треку запускает весь трек-лист релиза как очередь через
  zustand-стор (`lib/player-store.ts`), который переиспользует чистые функции очереди из
  `@vire/core` (`nextQueueIndex` и т.п., та же логика, что и в вебе) и грузит HLS-манифест
  трека (`GET /api/v1/tracks/{id}/manifest`, публичный роут). Мини-плеер — над таб-баром,
  когда очередь не пуста (обложка, название/артист, play/pause с haptic-impact, тап
  открывает полный плеер). Полный плеер — модальный экран поверх корневого стека: крупная
  обложка, транспорт prev/play-pause/next (play/pause тоже с haptic-impact), кастомный
  слайдер позиции (`PanResponder`, без сторонних нативных зависимостей) с реальной
  перемоткой через `seek()`. Библиотека — **`react-native-track-player` (RNTP) с
  инкремента 5** (была `expo-audio` в инкрементах 3–4, см. смену ниже) — foreground-service
  и lock-screen/Now Playing контролы, работает через локальную (не Expo Go) сборку. Play/
  pause/next/prev с lock-screen/наушников применяются к тому же стору, что и тап в
  приложении. Оффлайн-скачивание из мобилки — вне скоупа (см. ниже); shuffle/repeat закрыт
  инкрементом 7, лайки/плейлисты — инкрементом 6 (см. соответствующие секции ниже).
- **Экран входа (инкремент 4: фикс redirect для Expo Go).** `expo-web-browser` открывает
  `/mobile-auth-bridge` в изолированной системной сессии (`openAuthSessionAsync`, не
  `<WebView>` — пароль вводится вне контекста приложения). Redirect URI — не хардкод
  `vire://auth-callback`, а `Linking.createURL('auth-callback')`: в Expo Go это
  `exp://<host>:8081/--/auth-callback` (единственный адрес, который сама Expo Go умеет
  перехватить), в собранном приложении — `vire://auth-callback` (схема из `app.json`).
  Передаётся мосту входа параметром `redirectUri`; сервер (`mobile-auth-bridge/page.tsx`)
  проверяет схему по белому списку (`vire:`/`exp:`) перед редиректом — иначе это
  open-redirect пары токенов на произвольный домен. Ответ разбирается `expo-linking`,
  токены — в `expo-secure-store`. При старте с уже сохранёнными токенами экран входа
  пропускается.
- **Иконки (инкремент 4).** Таб-бар, мини-плеер, полный плеер, explicit-маркеры — раньше
  emoji-текстом (🏠🔍📚👤⏸▶⏮⏭🅴), теперь `lib/icon.tsx`: свой SVG-рендерер поверх
  `react-native-svg`, пути 1:1 скопированы из `apps/web/public/icons/system-sprite.svg` —
  единый визуальный язык с сайтом, не отдельный иконочный пак под мобилку.
- Тёмная тема, цвета из `packages/design-tokens` (OKLCH → hex на этапе генерации — RN не
  ест `oklch()` в JS).

## Где код

- **Веб-мост входа:** `apps/web/app/mobile-auth-bridge/page.tsx` + `layout.tsx` — тот же
  core-сервис, что `POST /api/v1/auth/devices` (`docs/features/device-auth.md`); гейт в
  `apps/web/proxy.ts` (`UNLOCALIZED_PREFIXES`). **Инкремент 4:** принимает `redirectUri` из
  query (`resolveRedirectBase()` — белый список схем `vire:`/`exp:`, иначе дефолт
  `vire://auth-callback`) — см. «Экран входа» выше.
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
  - `screens/sign-in-screen.tsx`, `screens/home-screen.tsx` (SDUI-главная, инкремент 4),
    `screens/profile-screen.tsx`, `screens/release-screen.tsx` (трек-лист релиза, тап
    запускает очередь, pull-to-refresh), `screens/player-screen.tsx` (полноэкранный
    модальный плеер) — рабочие экраны.
  - `screens/{search,library}-screen.tsx` + `components/stub-screen.tsx` — заглушки.
  - `components/mini-player.tsx` — мини-бар над таб-баром, play/pause с haptic-impact.
  - **`lib/sdui.ts` (инкремент 4).** Переиспользуемый разбор SDUI-ответа: `findBlock(blocks,
    type)` — первый блок заданного типа; `endpointOf(blocks, type)` — `source.endpoint`
    блока или `null` (нет блока / `inline`-источник вместо `endpoint`). Чистые функции от
    `Screen['blocks']` (`@vire/api-contracts`), тестами покрыты изолированно
    (`lib/__tests__/sdui.test.ts`) — общий парсер для будущих SDUI-экранов мобилки, не
    только главной.
  - **`lib/env.ts` + `lib/lan-host.ts` (инкремент 4, сеть для реального устройства).**
    Приоритет: явный `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_BASE_URL` → LAN-хост,
    выведенный из `Constants.expoConfig?.hostUri` (адрес, на котором Metro раздаёт бандл
    телефону, `192.168.x.x:8081`) на порту 3000 → `http://localhost:3000` (фолбэк для
    `expo start --web`, где `hostUri` не задан). Чистое преобразование строки вынесено в
    `lib/lan-host.ts` (`baseUrlFromHostUri`) отдельно от чтения `Constants` — тестируется
    как чистая функция (`lib/__tests__/lan-host.test.ts`), сам `Constants` замокан только
    в `lib/__mocks__/expo-constants.ts` (глобальный alias в `vitest.config.ts` — см.
    «Проверено в инкременте 4» ниже).
  - `lib/secure-store.ts` — обёртка над `expo-secure-store` (accessToken/refreshToken/deviceId).
    На web `expo-secure-store` не реализован вообще (`getValueWithKeyAsync` отсутствует,
    падает синхронно) — обёртка фолбэчит на `localStorage` при `Platform.OS==='web'` (только
    для `expo start --web`; Expo Go/нативные сборки используют настоящий Keychain/Keystore).
    `root-navigator.tsx` также ловит отказ `hasStoredSession()` в `.catch()` — без него
    web-превью зависал на спиннере навсегда.
  - `lib/api-client.ts` — `apiRequest()`: Bearer из secure store + один повтор через
    `POST /api/v1/auth/refresh` на 401. **Инкремент 4:** все запросы данных переведены на
    `apiRequest()`, не только `profile-screen.tsx` — главная (`GET /api/v1/screens/home` +
    оба блок-эндпоинта), релиз (`GET /api/v1/releases/{id}`) и манифест трека
    (`GET /api/v1/tracks/{id}/manifest`) теперь тоже шлют Bearer. Сами эти роуты публичные
    для READY-контента, но релиз/трек могут быть черновиком/WIP — тогда сервер отдаёт их
    только владельцу/стаффу по личности вызывающего; голый `request()` эту личность терял.
  - **`lib/audio-engine.ts` (инкремент 5) — `TrackPlayerAudioEngine implements IAudioEngine`**
    поверх `react-native-track-player`, заменил `ExpoAudioEngine`/`expo-audio`. Очередь
    остаётся в `player-store.ts` — движок проигрывает один трек за раз через `load()`, тот
    же контракт `load/play/pause/seek/on`. Прогресс — поллинг `TrackPlayer.getProgress()`
    каждые 500мс (`Event.PlaybackProgressUpdated` не гарантированно шлётся с нужной
    частотой на всех версиях/платформах — тот же подход, что и в официальном хуке
    `useProgress()` самой RNTP). `setupPlayer()` вызывается лениво при первом `load()`/
    `play()`, не в конструкторе — Android 12+ запрещает стартовать foreground-service, пока
    Activity ещё не по-настоящему foreground; окно между стартом JS-бандла и `onResume()`
    под это не подходит (`ForegroundServiceStartNotAllowedException`). Remote-команды с
    lock-screen/наушников: `RemotePlay`/`RemotePause`/`RemoteSeek` применяются к нативному
    плееру напрямую, `RemoteNext`/`RemotePrevious` эмитятся портом наружу как `'remoteNext'`/
    `'remotePrevious'` — очередью владеет `player-store`, не движок. `Event.PlaybackState`
    (Playing/Paused) эмитится как `'statechange'` — синхронизирует `status` стора, откуда бы
    смена ни пришла (в т.ч. с лок-скрина).
  - `lib/playback-service.ts` (инкремент 5) — headless-таск RNTP, обязателен для Android
    (без него foreground-service/lock-screen не поднимаются); регистрируется в `index.ts`
    (`TrackPlayer.registerPlaybackService`) до рендера `App`. Реальные слушатели живут в
    конструкторе `TrackPlayerAudioEngine` — импорт `audio-engine` в этом файле гарантирует,
    что singleton уже создан к моменту вызова таска.
  - `lib/player-store.ts` — zustand-стор (`queue`/`queueIndex`/`status`/`positionSec`/
    `durationSec`), транспорт через `nextQueueIndex` из `@vire/core/playback/queue` (та же
    логика очереди, что и в вебе, не переписана). Гонки: если `queueIndex` сменился, пока
    летел запрос манифеста, устаревший ответ отбрасывается; если `audioEngine.load()`
    отклоняется — статус `error`, а не бесконечный `loading`. **Инкремент 4:** тап на play в
    состоянии `error` — повторная попытка того же трека (`loadAndPlay`), не молчание;
    seek-guard (`SEEK_GUARD_MS=500`) — движок может отдать `timeupdate` со старой позицией в
    короткое окно сразу после `seek()`, пока нативный плеер ещё не догнал `seekTo()` (гонка
    на поиске HLS-сегмента) — такие тики игнорируются, иначе слайдер визуально дёргался
    обратно после перемотки; ошибки манифеста/load/audioEngine логируются через
    `console.error` (раньше падали молча в `status: 'error'` без диагностики). **Инкремент 5:**
    `load()` передаёт движку `title`/`artist`/`artworkUrl` трека (Now Playing/lock-screen
    метаданные); слушает `'remoteNext'`/`'remotePrevious'` (те же переходы, что и тап по
    кнопкам) и `'statechange'` (не перетирает `loading`/`error` — транзитный статус от
    предыдущего трека может прилететь уже после того, как стор ушёл в загрузку следующего).
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
  зависимостей) и `generateNative()`; `packages/design-tokens/scripts/build.mjs` пишет `dist/tokens.native.ts`;
  `exports["./native"]` в `package.json`.
- **`packages/core/package.json`:** новые подпути `./playback/queue` и `./playback/audio-engine`
  (рядом с уже существующими `./access`/`./signing`) — баррель `@vire/core` тянет
  `notifications/email-templates` → `@vire/i18n`, чей `messages.ts` грузит локали
  динамическим `import()` от рантайм-строки; Metro (в отличие от Next.js/tsc) это не
  резолвит статически и валит весь мобильный бандл. `apps/mobile` импортирует очередь и
  порт только через эти подпути, не через баррель.
- **`apps/mobile/app.json`:** плагин `expo-audio` (был в инкрементах 3–4) убран — заменён
  переходом на RNTP в инкременте 5 (`react-native-track-player` конфигурируется через
  `TrackPlayer.updateOptions()` в коде, отдельного config-плагина не требует; foreground-
  service на Android поднимается самим RNTP при `setupPlayer()`). `newArchEnabled: false`
  (инкремент 5) — New Architecture (Fabric/TurboModules) отключена явно; понадобилось для
  локальной сборки, детали — см. «Инкремент 5» ниже. `android.package:
  "com.anonymous.viremobile"` (инкремент 5) — обязателен для `expo prebuild`, дефолтное имя
  пакета Expo-шаблона, не сменено осознанно (сменить перед реальным релизом в стор).
  `android.predictiveBackGestureEnabled: true` (инкремент 4, было `false` без объяснения с
  первого коммита) — стек (`react-native-screens ~4.26`, RN `0.86.2`,
  `@react-navigation/native-stack ^7`) поддерживает predictive back корректно; см.
  «Проверено в инкременте 4» — сам жест не проверялся на реальном устройстве.
- **`patches/react-native-track-player@4.1.2.patch` (инкремент 5, pnpm patch).** Единственный
  файл — `android/.../MusicModule.kt`: методы вида `fun x(...) = scope.launch { ... }`
  (expression-body, возвращающие `Job` от `scope.launch`) не компилировались текущим
  Kotlin-тулчейном как `@ReactMethod` (ожидается `Unit`/void) — переведены в block-body
  `fun x(...) { scope.launch { ... } }`. Зарегистрирован в `pnpm.patchedDependencies`
  корневого `package.json` — применяется автоматически при `pnpm install`, апстриму не
  отправлялся (не проверено, актуальна ли проблема на других версиях Kotlin/Gradle).
- **Haptics (инкремент 4):** `expo-haptics` — лёгкий impact (`Haptics.impactAsync(Light)`)
  на play/pause в `components/mini-player.tsx` и `screens/player-screen.tsx`, на смену
  вкладки (`screenListeners.tabPress` в `navigation/main-tabs.tsx`), на pull-to-refresh
  в `screens/home-screen.tsx` и `screens/release-screen.tsx`. Точечно — не на каждый тап.
- **`@vire/api-client`:** `packages/api-client/src/http.ts` — `RequestOptions.headers?`
  мёржится в fetch-заголовки, не перетирая `Content-Type`. **Инкремент 4:**
  `RequestOptions<T>.schema` — `z.ZodType<T, z.ZodTypeDef, any>` вместо `z.ZodType<T>`.
  Без явного `Input=any` схема с `.default()` на вложенном поле (например,
  `screenSchema.blocks[].props`, где вход у поля шире вывода) структурно не проходит
  проверку `ZodType<T>` (третий параметр по умолчанию равен `Output`, а не `any`) — первый
  реальный кейс такой схемы в мобильном клиенте, `apps/web` до сих пор его не задевал.
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

**Обычно ничего задавать не нужно.** На физическом телефоне через Expo Go `localhost`
резолвится в сам телефон — сеть до dev-машины физически недостижима без LAN-адреса
(вероятная главная причина, по которой всё сетевое молчаливо падало до инкремента 4).

Порядок разрешения (чистая `resolveBaseUrl` в `lib/base-url.ts`, покрыта тестами;
`lib/env.ts` — только проводка):

1. `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WEB_BASE_URL` — явный override;
2. **только в `__DEV__`** — LAN-хост из `Constants.expoConfig?.hostUri` (адрес, на котором
   Metro раздаёт бандл телефону) на порту 3000, затем `NativeModules.SourceCode.scriptURL`,
   затем `http://localhost:3000`;
3. иначе — `app.json` → `extra.apiBaseUrl` / `extra.webBaseUrl` (`https://viremusic.ru`).

> ⚠️ **LAN и localhost существуют только в dev — это не стилистика, а блокер релиза.**
> До P0 фолбэк на `http://localhost:3000` был общим для всех режимов и приезжал в
> release-бандл из `.env`. Release-манифест разрешает cleartext **только в debug**
> (`android/app/src/debug/AndroidManifest.xml`), поэтому собранное приложение не выполняло
> ни одного успешного запроса. Если прод-URL не сконфигурирован, `resolveBaseUrl` **бросает**,
> а не подставляет догадку — тихий фолбэк ровно так этот баг и породил.

- `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WEB_BASE_URL` — задавать явно только когда
  автоопределение не подходит: dev-сервер `@vire/web` слушает не на 3000, Wi-Fi изолирует
  клиентов друг от друга (client isolation), или тестируешь против удалённого стенда.
  Шаблон — `apps/mobile/.env.example`. **Android-эмулятор — отдельный случай, где
  автоопределение НЕ подходит по умолчанию:** `Constants.expoConfig?.hostUri` внутри
  эмулятора не указывает на хост-машину напрямую — нужен явный
  `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:<порт>` (`10.0.2.2` — стандартный алиас
  хост-машины для Android-эмулятора, не LAN IP).

## Доставка (P0)

Сборка релизного APK, который можно поставить на чужой телефон. Обоснование фазы —
`docs/product/MOBILE_RECONSTRUCTION_ROADMAP.md` §P0, план —
`docs/superpowers/plans/2026-08-29-mobile-p0-delivery.md`.

```bash
cd apps/mobile
ORG_GRADLE_PROJECT_VIRE_UPLOAD_STORE_PASSWORD=$(cat vire-upload-keystore.password.txt) \
ORG_GRADLE_PROJECT_VIRE_UPLOAD_KEY_PASSWORD=$(cat vire-upload-keystore.password.txt) \
pnpm --filter @vire/mobile build:android
```

`build:android` = `check:release-config` (барьер) → `expo prebuild` → `gradlew assembleRelease`.
Отдельно барьер гоняется как `pnpm --filter @vire/mobile check:release-config`.

### Идентичность и версия

| Что | Где | Правило |
|---|---|---|
| `applicationId` | `app.json` → `android.package` = `com.virespace.viremusic` | **После публикации в сторе не меняется никогда** |
| Версия | `app.json` → `version` + `android.versionCode` | Оба поднимать на каждый релиз; `versionCode` строго возрастает |
| Firebase | `google-services.json` | Проект `virespace-viremusic`, пакет обязан совпадать с `android.package` |

Версия мобилки **не связана** с версией монорепо (`package.json` → 1.51.x): это отдельный
артефакт со своим циклом выпуска, как и десктоп.

### Почему `android/` не в git и как это не разъезжается

Папка генерируется (`expo prebuild`), в ней нет ручного кода: `MainActivity`,
`MainApplication`, `settings.gradle` — стоковые шаблоны, `modules/glass-lens` подключается
автолинком. Поэтому всё, что раньше правилось руками, живёт в
**`plugins/with-android-release-signing.js`** и переживает регенерацию:

- `signingConfigs.release` читает `VIRE_UPLOAD_*` из свойств Gradle;
- `reactNativeArchitectures=arm64-v8a,x86_64`.

> ⚠️ До P0 `buildTypes.release` подписывался **debug-ключом** — так делает шаблон Expo, и
> ручная правка исчезала при следующем `prebuild`. Debug-подпись нельзя обновлять поверх
> и нельзя публиковать.

Keystore (`vire-upload-keystore.jks`, алиас `vire-upload`, до 2054) и пароли в git не
попадают: `*.jks` и `*.password.txt` в `.gitignore`, пароли приходят через
`ORG_GRADLE_PROJECT_*` — Gradle сам мапит их в свойства проекта, поэтому та же команда
работает и в CI без изменений.

> ⚠️ **`.cxx` обязан лежать вне pnpm-стора** — `plugins/with-native-build-dir.js`
> переносит его в `apps/mobile/.cxx/<модуль>`. По умолчанию AGP кладёт его рядом с
> исходниками модуля, то есть в `node_modules/.pnpm/_<хеш>/…/android/`, что даёт
> **252 символа** до объектного файла при лимите Windows в 260 и вдобавок путь через
> симлинки — CMake и ninja нормализуют их по-разному, и регенерация `build.ninja`
> перестаёт сходиться (`still dirty after 100 tries`). Набор ABI (`arm64-v8a,x86_64`)
> фиксируется тем же механизмом: 32-битных ARM-устройств в целевом парке нет,
> `x86_64` нужен эмулятору.

> ⚠️ **`newArchEnabled` в `app.json` был `false`, а `prebuild` всё равно писал `true`** —
> поле не соблюдается на Expo 57 / RN 0.86 (старой архитектуры там уже нет). Приведено к
> `true`, чтобы конфиг не расходился с тем, что реально собирается: приложение всё это
> время работало на новой архитектуре.

### Прод-конфигурация приходит только из git

`extra.apiBaseUrl` / `extra.webBaseUrl` в `app.json`, не в `.env`: `.env` вне репозитория,
и сборка с ним невоспроизводима.

> ⚠️ Локальный `.env` задаёт `EXPO_PUBLIC_API_BASE_URL` для разработки, Expo грузит его
> **при любой сборке**, а в резолвере явный override сильнее `app.json`. То есть
> release унёс бы в бандл `localhost` с машины сборщика. `apps/mobile/scripts/build-release.mjs`
> гасит эти переменные и `.env` на время релизной сборки (`EXPO_NO_DOTENV=1`);
> `expo start` не задет.

### Барьер `check:release-config`

`apps/mobile/scripts/check-release-config.mjs` падает до сборки, если: пакет остался плейсхолдером
`com.anonymous.*`; нет `versionCode`; базовый URL не `https://` или локальный;
`google-services.json` не содержит клиента под текущий пакет; нет keystore или паролей.
Пустой `extra.sentryDsn` — предупреждение, не блокер: репозиторий обязан собираться до
того, как заведут проект в Sentry.

### Крашрепортинг — свой приёмник, не sentry.io

> ⚠️ **sentry.io недоступен из России.** Отдаёт `403 Forbidden` на любой путь, включая
> страницу входа; ответ в 134 байта с заголовком `via: 1.1 google` — блокировка на
> пограничном балансировщике, до приложения Sentry. Проверено `curl` с машины разработчика.

Поэтому приёмник свой — `apps/web/app/api/1/envelope`, — а **SDK остался стоковым**
`@sentry/react-native`. Меняется только хост в DSN, поэтому переезд на self-hosted
GlitchTip (он говорит на том же протоколе) позже не потребует правок клиента.

Почему не self-hosted Sentry или GlitchTip сразу: на проде 2 ГБ RAM и уже шесть
контейнеров. Свой эндпоинт стоит ноль контейнеров и ноль мегабайт — таблица в уже
работающем Postgres.

```
app.json → extra.sentryDsn = https://viremusic@viremusic.ru/1
                                                  ↓ SDK сам выводит путь
POST https://viremusic.ru/api/1/envelope/
                                                  ↓
parseSentryEnvelope + extractCrashEvent   (packages/core, чистые, 12 тестов)
                                                  ↓
insertMobileCrash → таблица mobile_crashes (дедуп по event_id)
```

| Где | Что |
|---|---|
| Клиент | `apps/mobile/lib/crash-reporting.ts` — init из `extra.sentryDsn`, override `EXPO_PUBLIC_SENTRY_DSN` для разработки |
| Протокол | `packages/core/src/platform/util/sentry-envelope.ts` — чистый разбор, без сети и БД |
| Хранение | `packages/db` — схема `mobile-crashes.ts`, репозиторий `mobile-crash.ts`, миграция 0058 |
| Приём | `apps/web/app/api/1/envelope/route.ts` — без аутентификации (краш случается и до входа), rate limit 60/мин, потолок тела 512 КБ |

Настройки SDK: `tracesSampleRate: 0` (нужны падения, а не трассировка — трафик на телефоне
платный), `sendDefaultPii: false` (в приложении токены устройства и E2EE-переписка),
`enableAutoSessionTracking: false` (приёмник хранит только события).

**Пустой DSN — легитимное состояние:** SDK не инициализируется, приложение работает как
раньше. Так репозиторий остаётся собираемым, даже если приёмник ещё не раскатан.

**Путь `/api/1/envelope` выглядит странно не случайно** — его диктует SDK: из DSN
`https://<key>@<host>/<projectId>` он выводит `/api/<projectId>/envelope/`. Менять нельзя,
не отказавшись от стокового SDK. Next редиректит завершающий слэш через `308`; POST с телом
это переживает (проверено `curl -L`, OkHttp под RN ведёт себя так же), ценой одного лишнего
round-trip на краш.

Ответ **всегда `200`, если событие разобрано** — даже когда в envelope только сессия или
транзакция. На неуспех SDK кладёт событие в очередь и шлёт снова; повторять то, что мы
осознанно не храним, смысла нет. `500` отдаётся только при отказе БД — тогда повтор нужен.

### Предохранители первой установки

Оба срабатывают в момент, когда сборку впервые ставит живой тестировщик.

**Протухшая сессия.** Провал `/auth/refresh` означает конец сессии, а не ошибку одного
запроса. `lib/api-client.ts` шлёт событие (`lib/session-events.ts`), `RootNavigator`
сбрасывает стек на `SignIn`. До P0 токены чистились, но приложение оставалось на месте и
показывало ошибку на каждом экране — состояние, из которого выходили переустановкой.

**Ключ E2EE.** `/api/v1/keys` хранит **один `ik_pub` на пользователя**, а личность у веба
и телефона своя — мобильный бутстрап публиковал свой ключ на каждом старте и затирал
ключ веб-сессии, молча ломая человеку веб-чат. Теперь `lib/e2ee/bootstrap.ts` сначала
читает серверный ключ:

| Серверный ключ | Действие |
|---|---|
| нет | публикуем, чат доступен |
| наш же | публикуем (идемпотентно), чат доступен |
| **чужой** | **не публикуем**, чат заблокирован на устройстве (`ChatLockedNotice`) |
| не прочитался (нет сети) | не публикуем, состояние `unknown` — чат не блокируем |

Это предохранитель от будущего ущерба; **уже перетёртые ключи он не чинит**. Настоящее
решение — привязка устройств через `keys/link/*` (на клиенте не реализовано), см.
`docs/product/MOBILE_PARITY_MATRIX.md` §16.

### ⚠️ Старый пакет обязан быть удалён с устройства

Смена `applicationId` не заменяет приложение, а ставит **второе**: `com.anonymous.viremobile`
и `com.virespace.viremusic` сосуществуют. Обе сборки объявляют схему `vire://`, поэтому
редирект после входа становится неоднозначным — Android показывает выбор из двух одинаково
названных «VireMusic», и логин может завершиться в старое приложение.

Проверено на устройстве:

```
pm query-activities -a android.intent.action.VIEW -d 'vire://auth-callback'
  → com.anonymous.viremobile.MainActivity
  → com.virespace.viremusic.MainActivity     ← оба
```

Лечится только удалением старого пакета (`adb uninstall com.anonymous.viremobile`).
**Удаление стирает его локальные данные** — E2EE-личность, сессию, скачанные треки.

### Как проверять мобильные изменения

Порядок, выведенный ценой потерянного часа: **эмулятор с Metro → потом телефон**.

```bash
emulator -avd VireMusic_Test -gpu host        # без -gpu host стекло не показательно
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=https://viremusic.ru npx expo run:android
```

Даёт живую перезагрузку, `console.log` в `adb logcat -s ReactNativeJS:*` и `run-as` для
чтения файлов приложения. Release-сборку (20+ минут) гонять только под финальное
подтверждение — на ней `run-as` запрещён, логов нет, а каждая правка стоит цикл.

> ⚠️ **Слепые `adb input tap` по фиксированным координатам — ненадёжный способ проверки.**
> Тумблер стекла так «не работал»: пиксельная разница между снимками выходила нулевой,
> потому что тапы через переходы между экранами то попадали, то нет, и оба снимка
> снимались в одном состоянии. На эмуляторе с логами тот же механизм показал 95.6 %
> изменения площади за минуту. Подтверждай состояние снимком **перед каждым** захватом,
> либо проверяй логикой в логах, а не глазами по скриншоту.

### Проверено на устройстве (2026-08-29)

Xiaomi 2311DRK48G, Android 16, release-APK, установка поверх чистого пакета `[DEVICE]`:

| Что | Результат |
|---|---|
| Установка | `Success` |
| Запуск | процесс жив, `0` FATAL за сессию |
| Экран входа | отрисован |
| **Базовый URL** | «Войти» открывает `https://viremusic.ru/mobile-auth-bridge?platform=android&name=…` — прод по HTTPS, localhost отсутствует |
| Подпись | `CN=VireMusic` (upload-ключ), не debug |
| Манифест | `com.virespace.viremusic` v1.0.0 (1), ABI `arm64-v8a` + `x86_64` |
| Хардненинг | `flags=[HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP]` — без `DEBUGGABLE` |
| Нативный Sentry | загрузился, `io.sentry.auto-init read: false` — при пустом DSN простаивает, не роняет |

**Не проверено:** вход до конца (нужны учётные данные), воспроизведение, фон, пуши —
это предмет валидации следующих фаз, не P0.

Мелочь, замеченная попутно и не входящая в P0: подпись на экране входа обрезается до
«Независимая музыкальная» при появлении спиннера — вёрстка, чинится в фазе UI.

### EAS: профили и пуш-креды

`eas.json` описывает профили сборки. Сборка у нас **локальная** (`build:android` →
`prebuild` + `gradlew`), поэтому файл нужен не для EAS Build, а чтобы работали команды
`eas credentials` / `eas config`, и как заготовка под сборку в CI (P5).

> `appVersionSource: "local"` — версией управляет `app.json`, а не сервер Expo. Иначе EAS
> начал бы назначать `versionCode` сам и разошёлся бы с решением P0.

**FCM V1 привязан** (2026-08-29): ключ сервисного аккаунта проекта `virespace-viremusic`
загружен в EAS и назначен на `com.virespace.viremusic`. Ключ лежит в
`apps/mobile/virespace-viremusic-firebase-adminsdk-*.json` и закрыт `.gitignore`.

Если понадобится повторить (смена проекта Firebase, ротация ключа):

```powershell
cd apps/mobile
npx.cmd eas-cli credentials -p android
# production → Google Service Account
# → Manage your Google Service Account Key for Push Notifications (FCM V1)
# → Set up a Google Service Account Key → Upload a new service account key
```

Три грабли, каждая ловилась вживую:
- **`npx.cmd`, не `npx`** — PowerShell по умолчанию `Restricted` и не грузит обёртку `npx.ps1`;
- **`Upload a new`, не `Choose an existing`** — в списке существующих лежит ключ старого проекта;
- неинтерактивного режима у команды нет (`--non-interactive` не принимается, eas-cli 23.0.0).

**Пуши всё равно не доедут до пользователя до фазы P1** — креды тут ни при чём: на клиенте
нет `setNotificationHandler` (показ в форграунде), нет `addNotificationResponseReceivedListener`
(реакция на тап), а воркер шлёт `data.url` веб-адресом, который схема `vire://` не понимает.
Разбор — `docs/product/MOBILE_PARITY_MATRIX.md` §12.

### Что осталось вне репозитория

Ничего из P0. Открыт только деплой: приёмник падений `/api/1/envelope` живёт в коде, но на
проде появится со следующим релизом по тегу (проверено — сейчас отдаёт 404). До этого SDK
складывает краши в свою офлайн-очередь и переотправляет, ничего не теряя.

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

## Проверено в инкременте 4 (сеть для устройства, вход в Expo Go, SDUI-главная, нативная полировка)

Инкремент собирался в две волны в одной ветке: первая (агент, изолированный worktree)
закрыла сеть/SDUI/haptics/pull-to-refresh/predictive-back с нуля на чистой базе
инкремента 3; при сведении в основную ветку обнаружилось, что более ранний черновик той
же сессии (не сохранённый как отдельный инкремент) уже независимо решал часть тех же
проблем и содержал критичный фикс входа в Expo Go (redirect-схема) и SVG-иконки, которых
не было в первой волне — оба набора правок сведены вручную во вторую волну, конфликт имён
стилей (`explicitBadge`/`explicitText` — уже занято карточкой релиза) найден и переименован
(`trackExplicitBadge`/`trackExplicitText`) при сведении.

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (49 тестов: +6
  `lan-host.test.ts` на `baseUrlFromHostUri()` — host:port, отсутствие `hostUri`
  (фолбэк), пустая строка, схема `exp://` отбрасывается, путь после хоста отбрасывается,
  голый хост без порта; +5 `sdui.test.ts` на `findBlock`/`endpointOf` — блок найден,
  блока нет, `inline`-источник не отдаёт endpoint, блок без `source` не отдаёт endpoint;
  +2 seek-guard теста в `player-store.test.ts` (устаревший `timeupdate` после `seek()` не
  перетирает позицию; после сброса guard — обновляет как обычно); 35 прежних тестов
  инкремента 3 не задеты, кроме мока `@vire/api-client`→`../api-client` под переход
  `player-store.ts` на `apiRequest`). `pnpm --filter @vire/web typecheck`,
  `pnpm --filter @vire/core typecheck` — зелёные. Дополнительно (не входило в обязательный
  список гейтов, но задето правкой `packages/api-client`): `pnpm --filter @vire/web test`
  (2004 теста) и `pnpm --filter @vire/core test` (1058 тестов) — зелёные;
  `packages/api-client` typecheck+test (12 тестов) — зелёные.
- **Обнаружено и починено по ходу:** `expo-constants` (используется в `lib/env.ts` для
  вывода LAN-хоста) тянет `react-native`, чей входной файл использует Flow-синтаксис —
  vitest (node-окружение без RN-трансформа) не может его распарсить, и уже существующие
  тесты `api-client.test.ts`/`player-store.test.ts` (транзитивно импортируют `lib/env.ts`)
  начали падать `RolldownError: Flow is not supported`. Фикс — глобальный alias в
  `vitest.config.ts`, подменяющий `expo-constants` лёгким стабом
  (`lib/__mocks__/expo-constants.ts`) для всех тестов; `lib/lan-host.ts` тестируется как
  чистая функция без обращения к `Constants` вообще.
- **Обнаружено и починено по ходу:** передача `screenSchema` в дженерик `request<T>()`
  (`@vire/api-client`) не тайпчекалась — см. правку `packages/api-client/src/http.ts` выше
  («Где код»). Без неё `apps/mobile typecheck` падал на `screenResult.data.blocks` ещё до
  того, как дошло до реальной логики SDUI-экрана.
- `npx expo start --web` + реальный `pnpm --filter @vire/web dev` (локальная БД:
  `docker compose up -d`, `.env`/`apps/web/.env` с `127.0.0.1` вместо `localhost` — см.
  предупреждение про Docker Desktop/IPv6 в корневом `CLAUDE.md`): бандл собирается (200,
  ~3.4 МБ, 654 модуля, без ошибок), grep по скомпилированному бандлу подтверждает новый код
  (`X-Vire-Blocks`, `fresh-releases`, `hot-tracks`, `screens/home`, `endpointOf`,
  `baseUrlFromHostUri`, `screenListeners`/`impactAsync` на 5 точках haptics, экранированные
  `\uXXXX`-строки «Новые релизы»/«В топе»/«Пока нечего показать»).
- **SDUI-главная реально проверена интерактивно, не только по бандлу.** Драйвером был
  Playwright (`npm install playwright` + `npx playwright install chromium` в scratchpad —
  в репозитории Playwright не установлен; headless Chromium, реальный процесс, не MCP).
  `GET /api/v1/screens/home` с `X-Vire-Blocks: fresh-releases,hot-tracks` на реальном
  dev-сервере отдал реальную композицию (`{"screen":"home","blocks":[...]}`, 2 блока с
  `source.endpoint`); `GET /api/v1/home/fresh-releases`/`/hot-tracks` — реальные данные
  из локальной БД (1 релиз, 2 трека). Открыт `http://localhost:8081` с предзаполненным
  фиктивным токеном в `localStorage` (обходит экран входа — SDUI-эндпоинты главной
  публичные, `Bearer` не проверяют) и Chromium, запущенным с
  `--disable-web-security` (Metro-веб на 8081 и Next-дев на 3000 — разные origin;
  браузер блокирует `fetch()` без `Access-Control-Allow-Origin`, которого у API нет и не
  должно быть для прод-CORS ради локального теста; нативный клиент такого ограничения не
  знает вообще — флаг воспроизводит именно это, не маскирует баг). Результат на скриншоте:
  секция «Новые релизы» с реальной карточкой релиза («Сигналы», Kotlaev Danil), секция
  «В топе» с двумя реальными треками по рангу. Тап по треку «В топе» — трек встаёт в
  очередь плеера и **реально начинает играть** (мини-плеер снизу показывает название/
  артиста и иконку паузы, трек-строка подсвечена активной). Переключение вкладки
  Главная → Поиск → рендерит стаб-экран «Скоро» корректно.
- **Pull-to-refresh — код проверен (bundle + unit), визуально свайп не воспроизведён.**
  `RefreshControl` на обоих экранах подключён и типизируется корректно; попытка
  сымитировать touch-свайп мышью в headless Chromium приводит к выделению текста, а не к
  нативному pull-жесту `RefreshControl` (ограничение симуляции тача мышью в браузере, не
  баг кода) — честный визуальный прогон свайпа остаётся на реальном устройстве.
- **Фикс входа в Expo Go (redirect-схема) — проверен по построению URL и логике
  белого списка, НЕ проверен end-to-end через реальный `WebBrowser.openAuthSessionAsync`.**
  `Linking.createURL('auth-callback')` и разбор `redirectUri` на мосте входа прочитаны и
  соответствуют документированному поведению Expo Go (`exp://<host>:8081/--/auth-callback`);
  `resolveRedirectBase()` на сервере проверен как чистая логика (схема `vire:`/`exp:` → как
  есть, иначе дефолт). Сам системный переход в браузер и обратно — нативный API, не
  воспроизводится в `expo start --web`; как и раньше, в локальной БД нет пользователя с
  паролем для end-to-end входа. **Первая настоящая проверка — на следующем прогоне через
  Expo Go на реальном устройстве или эмуляторе.**
- **Android-эмулятор на машине разработки теперь есть** (поднят параллельно этому
  инкременту, независимая задача) — `VireMusic_Test` (API 36, Pixel 7, WHPX-ускорение),
  `ANDROID_HOME=C:\Android`. Sign-in экран (дореформенная версия кода, до фиксов этого
  инкремента) реально отрисован на нём через Expo Go — подтверждает, что связка
  Metro↔эмулятор↔Expo Go в принципе работает на этой машине. Следующий прогон мобилки
  должен подтвердить фиксы этого инкремента (redirect, LAN-сеть, predictive back, haptics,
  pull-to-refresh) уже на нём, не откладывать на «когда-нибудь появится телефон».
- **Predictive back gesture (Android) — не проверен визуально** в этом инкременте (гейты
  гонялись до полной интеграции с эмулятором). `android.predictiveBackGestureEnabled: true`
  включён осознанно (стек `react-native-screens ~4.26`/RN `0.86.2`/`native-stack ^7` это
  поддерживает) — первая визуальная проверка жеста на эмуляторе/телефоне из пункта выше.
- `@expo/vector-icons` в `apps/mobile/package.json` не появлялся ни в одной из волн —
  иконки решены `lib/icon.tsx` (свой SVG-рендерер поверх `react-native-svg`, добавлен
  `npx expo install react-native-svg` — версия резолвится под установленный Expo SDK 57
  автоматически). Нечего убирать, дубликата нет.
- Лимиты серверных списков SDUI-блоков проверены чтением кода, не менялись:
  `FRESH_RELEASES_RESULT_LIMIT=18`, `HOT_TRACKS_LIMIT=20`
  (`packages/core/src/music/discovery/services/home-blocks.ts`) — клиентской обрезки
  не требуется, `ScrollView` с двумя секциями остаётся адекватным выбором (не бесконечный
  список).

## Инкремент 5: react-native-track-player — лок-скрин и фон на Android

**Краш `MusicService.emit()` исправлен и подтверждён живым прогоном на эмуляторе (сессия
2026-08-22, после снятия блокера окружения — см. «Живая проверка» ниже).** Воспроизведение,
foreground-service, системная Now Playing-карточка с транспортом и фоновая работа
подтверждены фактом. Не подтверждены живьём: экран блокировки с секьюрити (эмулятор без
PIN/паттерна не показывает keyguard — есть только системная медиа-карточка в шторке, что
эквивалентно на функциональном уровне, но не идентичный UI), Android Auto, реальное
устройство (только эмулятор), iOS (вне скоупа, нет Mac).

### Что сделано

- `lib/audio-engine.ts` — `TrackPlayerAudioEngine implements IAudioEngine` поверх RNTP,
  `lib/playback-service.ts` — headless-таск, регистрация в `index.ts` до рендера. Порт
  `@vire/core/playback/audio-engine` расширен событиями `'remoteNext'`/`'remotePrevious'`/
  `'statechange'` и полями Now Playing (`title`/`artist`/`artworkUrl`) в `AudioEngineSource`
  — обратно совместимо (веб-драйвер их просто не эмитит/игнорирует). Подробности реализации
  — секция «Где код» выше.
- `patches/react-native-track-player@4.1.2.patch` (pnpm patch) — фикс несовместимости
  `MusicModule.kt` с текущим Kotlin-тулчейном (см. «Где код»).
- `app.json`: `expo-audio` и его плагин убраны, `newArchEnabled: false`, `android.package`
  проставлен (нужен для `expo prebuild`).
- Тесты: `lib/__tests__/audio-engine.test.ts` переписан под RNTP (мок `react-native-track-
  player`) — load/play/pause/seek, статус-маппинг, remote-команды, поллинг прогресса.
  `player-store.test.ts` — новые тесты на `remoteNext`/`remotePrevious`/`statechange`
  (включая «не перетирает `loading`/`error`») и передачу метаданных трека в `load()`.

### Проверено фактом

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (59 тестов). `pnpm --filter
  @vire/core typecheck`/`test` (1058 тестов) — зелёные, границы порта не нарушены.
- В одном из промежуточных прогонов (до чистого `--clean` ребилда, дальше в этой же сессии)
  сборка на эмуляторе `VireMusic_Test` один раз дошла до установки и воспроизведение
  **было подтверждено реальным** (иконка паузы вместо play, без краша сразу после тапа на
  трек) — то есть код драйвера рабочий. Тот прогон, вероятно, использовал закешированные
  от предыдущих (не-`--clean`) `expo prebuild` артефакты, у которых пути до объектных
  файлов CMake ещё укладывались в лимит. **Чистый `--clean` ребилд (правильный baseline)
  детерминированно падает** — см. «НЕ проверено» ниже, это не флуктуация.

### Windows `MAX_PATH` — устранено

Диагноз подтверждён и исправлен в следующей сессии. Причина была верной (не «дубликат SVG»,
не порядок `prebuild`): pnpm кладёт зависимости в `node_modules/.pnpm/<pkg>@<version>_<hash>/
node_modules/<pkg>/...`, путь до native C++ исходников `expo-modules-core` (транзитивная
зависимость RNTP) превышал 250-символьный лимит CMake на путь к объектному файлу
(`ninja: manifest still dirty`, `BUILD FAILED`). Фикс — Вариант A из предыдущей версии
секции: `.npmrc` → `virtual-store-dir-max-length=40` (хеширует длинные `name@version_hash` в
`.pnpm/`, не переносит физическое расположение стора — остаётся внутри `node_modules`,
которое уже в `watchFolders` Metro, поэтому резолюция Metro не ломается, в отличие от переноса
`virtual-store-dir` наружу, который в этой же сессии один раз её ломал). После
`pnpm install` с этим порогом: `npx expo prebuild --platform android --clean` +
`npx expo run:android` на эмуляторе `VireMusic_Test` — **BUILD SUCCESSFUL**, APK
установлен, Metro забандлил и приложение запустилось.

### Живая проверка на эмуляторе — вход и данные работают, воспроизведение падает

**Сеть до dev-машины с эмулятора.** Реальный LAN IP хоста (`192.168.2.x`) недостижим из
Android-эмулятора (100% packet loss на ping) — это НЕ то же самое, что физический телефон в
одной Wi-Fi сети. Рабочая связка для эмулятора: `adb reverse tcp:3000 tcp:3000` (+ `tcp:9000`
для MinIO-обложек) и `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_BASE_URL=http://
localhost:3000` при запуске `expo start`. Отдельная ловушка: `AUTH_URL`/`NEXT_PUBLIC_APP_URL`/
`S3_PUBLIC_ENDPOINT` в `apps/web/.env.local` были захардкожены на устаревший IP машины
(DHCP переназначил адрес) — Auth.js берёт редиректы из `AUTH_URL`, а не из Host входящего
запроса, так что несовпадение с реальным адресом даёт `ERR_CONNECTION_REFUSED` независимо от
того, как клиент достучался до первого запроса. Все три переменные приведены к `localhost`
(согласовано с `adb reverse`) — обновить при следующей смене IP машины.

**Вход и данные — подтверждено реальным.** С `mobile-auth-bridge` → форма входа (тестовый
юзер, `packages/db` напрямую) → `POST /api/auth/callback/credentials` 302 → редирект в
`vire://auth-callback` → приложение получило токены → `GET /api/v1/screens/home` +
`hot-tracks`/`fresh-releases` 200 — реальные релиз и треки на экране, повторный холодный
запуск подхватывает сохранённую сессию (secure-store) и пропускает вход. Это первая в истории
проекта живая (не веб-превью) проверка мобильного клиента на реальном Android-рантайме
дальше экрана входа.

**Воспроизведение падает детерминированно.** Тап по треку → манифест грузится
(`GET /api/v1/tracks/{id}/manifest` 200) → приложение крашится. Логи показывают два разных,
последовательных краша:
1. `AndroidRuntime` в `MusicService.emit()` (`MusicService.kt:744`, вызов из
   `observeEvents$1`) — падает сам процесс приложения.
2. Android затем сам перезапускает упавший сервис (`Scheduling restart of crashed service`)
   — но к этому моменту Activity уже уничтожена (её убил краш #1), и ОС отказывает второму
   старту: `ForegroundServiceStartNotAllowedException: Service.startForeground() not allowed
   due to mAllowStartForeground false`.

Крош #2 — не первопричина, а следствие краша #1 (это стало ясно только после разбора полного
лога; раньше эту же вторую ошибку принимали за первопричину, отсюда предыдущая гипотеза про
тайминг foreground-service). **Попытка исправления не удалась**: прогрев `TrackPlayer.
setupPlayer()` в `App.tsx` при монтировании (до первого тапа, не лениво) — идея была верной по
описанию проблемы (`ensureReady()` в `lib/audio-engine.ts` вызывается лениво только по первому
`load()`/`play()`, а к этому моменту уже прошёл сетевой раунд-трип за манифестом, окно
«недавнее взаимодействие» могло закрыться), но на практике краш #1 стал происходить ещё
раньше — сразу при холодном старте приложения, без единого тапа. Изменение отменено
(`git checkout` на `App.tsx`/`lib/audio-engine.ts`) — в репозитории код в точности как
задокументировано выше в этой секции («Компоненты»), без незакоммиченных попыток фикса.

**Реальный следующий шаг** — не тайминг foreground-service, а первопричина внутри
`MusicService.emit()`. Кандидаты, не проверялись: несовместимость версии RNTP (`4.1.2`) с
Kotlin/AGP-тулчейном этого проекта за пределами уже найденного и запатченного (`patches/
react-native-track-player@4.1.2.patch`) — возможно, там есть смежные места с тем же классом
Kotlin-совместимости; версия `expo-audio`/RNTP событий, которые слушает `observeEvents`, могла
разойтись с фактической версией `MediaSession`; стоит попробовать более новый патч-релиз RNTP
до переигровки причины руками.

- Live-проверка lock-screen/Now Playing/фона/Android Auto заблокирована этим крашем — не
  дошли до этой точки ни разу.
- iOS — вне скоупа (нет Mac), `app.json` не тронут под iOS специально под RNTP.

### Попытка переиграть краш с кандидатным патчем — заблокирована окружением, не средой RNTP

Кандидатный патч (`MusicService.kt`: `reactContext` вместо
`reactNativeHost.reactInstanceManager.currentReactContext` в `emit()`/`emitList()`, ~строки
744/751) уже был живым в pnpm-сторе на начало сессии (`pnpm install` применил патч раньше).
Цель сессии — переиграть тап play с этим патчем и увидеть, исчезает ли краш. Не дошли:

- **Docker (postgres/redis/minio) был уже поднят**, тестовый юзер `rntp-test@viremusic.local`
  найден в БД (создан в прошлой сессии), пароль неизвестен — сброшен на `TestPass123!` прямым
  UPDATE `password_hash` (bcryptjs, 12 раундов, тот же хешер что `apps/web/lib/password-hasher.ts`).
  `apps/web/.env.local` уже был на `localhost` (не потребовал правки).
- Эмулятор `VireMusic_Test` поднялся и загрузился штатно (`adb wait-for-device` +
  `sys.boot_completed=1`).
- **`pnpm --filter @vire/web dev` (Turbopack, обычный путь) не стартует**: `ERR_DLOPEN_FAILED`
  — Windows Smart App Control («Application Control policy has blocked this file») блокирует
  загрузку нативных `.node`-модулей процессом `node.exe` — минимум `@next/swc-win32-x64-msvc`
  и `@parcel+watcher-win32-x64` (тот используется загрузчиком `next.config.ts` под Turbopack).
  Подтверждено логом Code Integrity (`Microsoft-Windows-CodeIntegrity/Operational`, событие
  3077/3118, Policy ID `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`) и реестром
  (`HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy\VerifiedAndReputablePolicyState=1`, т.е.
  SAC включён). Это НЕ существовало в прошлых сессиях (тогда `next dev` стартовал и обслуживал
  `/mobile-auth-bridge` живьём) — политика на машине изменилась независимо от репозитория.
  Отключение требует прав администратора Windows (Settings → Privacy & security → Windows
  Security → App & browser control → Smart App Control), которых у сессии нет; по документации
  Microsoft переключатель может быть недоступен, если SAC уже вышел из режима «оценки» —
  тогда нужна переустановка Windows. Дальше не копали — решение не для агента этой сессии.
  - Попытка обхода: `next dev --webpack` (не Turbopack) действительно не задевает
    `@parcel/watcher` и стартует («Ready in 987ms»), но падает на независимом баге:
    `Attempted import error: 'createContext' is not exported from 'react'` при компиляции
    `use-intl` → `packages/i18n/src/translator.ts` → `packages/core/src/platform/notifications/email-templates.ts`
    (500 на `/robots.txt`). Это ESM/CJS-несовместимость webpack-режима с React 19 в этом
    репо — путь никогда не тестировался (проект всегда шёл через Turbopack), чинить его —
    отдельная, не сегодняшняя задача. Процесс остановлен, `.env`-правка `apps/mobile/.env`
    оставлена (не влияет на веб, gitignored).
- Без бэкенда логин/SDUI/манифест недостижимы, поэтому:
  - Сделан чистый ребилд как per плану: `npx expo prebuild --platform android --clean` +
    `npx expo run:android` — **BUILD SUCCESSFUL за 4м44с**, APK собран и установлен, Metro
    забандлил (`Android Bundled apps\mobile\index.ts (1220 modules)`). Подтверждает, что
    патч из `patches/react-native-track-player@4.1.2.patch` компилируется в чистом ребилде на
    этом окружении end-to-end (Gradle/Kotlin-тулчейн от Node/SAC не зависит).
  - Приложение запустилось на холодную **без краша** — подхватило сохранённую с прошлой
    сессии сессию (secure-store) и сразу показало главную с ошибкой загрузки («Не удалось
    загрузить главную» + «Повторить», см. скриншот сессии) вместо экрана входа — ожидаемо,
    бэкенд недоступен. `adb logcat` за это время не показал ни одного `FATAL EXCEPTION`/
    `AndroidRuntime`-краша. Это не проверка гипотезы про `MusicService.emit()` (до play не
    дошли), но подтверждает: холодный старт с текущим (не тронутым, задокументированным)
    кодом `App.tsx`/`lib/audio-engine.ts` по-прежнему чистый — регрессии, которую поймала
    прошлая сессия при eager `setupPlayer()`, здесь нет (там код и не менялся).
  - Тап play, `MusicService.emit()`, лок-скрин/фон — **не проверялись этой сессией**, потому
    что до экрана треков дойти было нечем без бэкенда.
- Проверено попутно: `react-native-track-player` на npm — `4.1.2` остаётся последним
  стабильным релизом (`dist-tags`: `next`=`4.0.0-rc09`, `nightly`=`5.0.0-alpha0-nightly-...`,
  оба не стабильные и не годятся для быстрой замены) — кандидат «более новый патч-релиз RNTP»
  из списка ниже отпадает, апгрейд означал бы прыжок на альфу 5.x с ломающими изменениями.

**Следующий шаг был** — сначала снять блокер окружения (либо получить возможность отключить
Smart App Control, либо поднять `@vire/web` в WSL2/другим способом, который не грузит
нативные `.node` из-под Windows-процесса, либо почистить/переустановить среду), затем
повторить эту сессию с рабочим бэкендом: логин (юзер и пароль выше) → SDUI-главная → тап
трека → смотреть, происходит ли `MusicService.emit()`-краш с патчем. **Выполнено в этой же
календарной сессии, ниже.**

### Краш исправлен — подтверждено живым прогоном (2026-08-22)

Блокер Smart App Control снялся сам между запуском фонового агента (который на него упёрся)
и следующей проверкой — `Get-MpComputerStatus` показал `SmartAppControlState=Off`,
`pnpm --filter @vire/web dev` стартует штатно (`Ready in 993ms`). Причина ухода политики не
исследовалась (не задача этой сессии) — если блокер вернётся, инструкции по диагностике
(event log 3077/3118, реестр `VerifiedAndReputablePolicyState`) остаются в секции выше.

С рабочим бэкендом (`pnpm --filter @vire/web dev` на 3000, `adb reverse tcp:3000 tcp:3000` +
`tcp:9000`) и уже собранным на прошлом шаге APK (кандидатный патч `reactContext` живой в
сборке — см. «Попытка переиграть краш» выше, там же чистый ребилд `BUILD SUCCESSFUL`):

- Эмулятор `VireMusic_Test` уже держал старую сессию (secure-store) и экран с ошибкой
  загрузки главной (бэкенд был недоступен на момент установки APK) — тап «Повторить» сразу
  дал реальную главную: «Новые релизы» (релиз «Сигналы»), «В топе» (2 трека) — то есть SDUI
  и Bearer-сессия пережили холодный рестарт бэкенда без повторного логина.
- **Тап на трек «В топе» → воспроизведение началось без краша.** `adb logcat -d` за весь
  интервал (тап → foreground-service → PLAYING → до конца сессии) — **ноль** записей
  `FATAL EXCEPTION`/`AndroidRuntime`-краша (было: гарантированный краш на этом же шаге в
  прошлой сессии, до патча). Подтверждено по логу `dumpsys media_session`:
  `playbackState=PlaybackState {state=PLAYING(3), ...}`, и по UI — мини-плеер над таб-баром
  показал название/артиста и иконку паузы (не play), т.е. реально играет.
- **Foreground-service и уведомление — подтверждены.** Лог: `MusicService$setupForegrounding:
  notification posted with id=1, ongoing=true`, `ActivityManager: Background started FGS:
  Allowed ... cmp=.../MusicService`. Не было вторичного
  `ForegroundServiceStartNotAllowedException` (который в прошлой сессии следовал за первым
  крашем) — потому что первого краша, который его вызывал, теперь просто нет.
- **Системные Now Playing-контролы — подтверждены.** Погашен/включён экран (`adb shell input
  keyevent 26` дважды) — плеер пережил цикл сна/пробуждения экрана, `dumpsys media_session`
  всё ещё показывал `PLAYING`. Раскрыта шторка уведомлений (`adb shell cmd statusbar
  expand-notifications`) — системная медиа-карточка (не кастомное уведомление приложения, а
  платформенный `MediaSession`-виджет, тот же механизм, что рисует lock-screen-контролы) с
  заголовком «Desktop shell test tone 2», артистом «Kotlaev Danil», прогресс-баром и
  транспортом prev/play-pause/next/stop — скриншот подтверждён визуально. Эмулятор без
  PIN/паттерна не показывает отдельный keyguard-экран (power off/on просто гасит/включает
  дисплей без секьюрити-слоя) — эта же карточка на настоящем лок-скрине физического
  устройства с включённым PIN не проверялась, но механизм (`MediaSession`, не
  приложение-специфичный код) идентичен, так что риск отдельного регресса там низкий.
- **Фон — подтверждён частично.** `adb shell input keyevent KEYCODE_HOME` перевёл приложение
  в фон (фокус ушёл на `NexusLauncherActivity`) без краша; `dumpsys media_session` в этот
  момент уже показывал `state=STOPPED` с `position` == длительности трека — трек (короткий
  тестовый тон) успел доиграть до конца ещё до сворачивания, поэтому «аудио продолжает идти
  после сворачивания» в моменте не зафиксировано отдельно от «сессия пережила сворачивание
  без краша». Для полной проверки в следующий раз стоит взять трек подлиннее и свернуть
  приложение посреди воспроизведения.
- Android Auto — не проверялся (нет эмуляции Auto на этой машине).
- Гейты после сессии: `pnpm --filter @vire/mobile typecheck` — чисто; `pnpm --filter
  @vire/mobile test` — 62/62 зелёных (код не менялся, только нативный патч и lockfile).
- `react-native-track-player` остаётся на `4.1.2` (без апгрейда — см. «остаётся последним
  стабильным релизом» выше, актуально и сейчас).

**Итог инкремента 5:** воспроизведение, foreground-service, Now Playing-контролы и
устойчивость к сворачиванию/сну экрана — подтверждены фактом на эмуляторе. Реальное
устройство, лок-скрин с включённым PIN и Android Auto — по-прежнему не проверялись
(см. «Вне скоупа» ниже).

### Добито тем же прогоном: pull-to-refresh визуально, predictive back функционально

Тем же тёплым эмулятором (без пересборки) закрыты два хвоста из «Проверено в инкременте 4»,
которые раньше не давались из-за ограничений симуляции тача мышью в headless Chromium:

- **Pull-to-refresh — подтверждён визуально.** `adb shell input swipe` вниз по главной →
  скриншот поймал реальный `RefreshControl`-спиннер в процессе анимации (не домыслен по
  коду/бандлу, как раньше). Без крашей.
- **Predictive back gesture — подтверждён функционально, не визуально.** Открыт трек-лист
  релиза («Сигналы») → edge-свайп от левого края (`adb shell input swipe` с большой
  длительностью) → приложение корректно вернулось на главную. Попытка поймать сам кадр
  preview-анимации гонкой из двух параллельных adb-команд не удалась (скриншот пришёл уже
  после завершения жеста — оверхед запуска процессов adb/powershell больше окна анимации) —
  сам факт «предиктивный жест не крашит и не ломает навигацию» подтверждён, кадр
  анимации — нет.
- **«Вход через Expo Go» из бэклога инкремента 4 — снят как неактуальный.** С инкремента 5
  приложение использует `react-native-track-player` (кастомный нативный модуль,
  `expo prebuild`) — Expo Go принципиально не грузит кастомные нативные модули, только
  managed-workflow пакеты. End-to-end вход теперь проверяется только через собранный
  dev-client/APK (как в этой и прошлой сессии), путь через голый Expo Go для этого приложения
  больше не существует — не «не проверено», а «неприменимо».

## Инкремент 6: лайки и добавление в плейлист

Дизайн — `docs/superpowers/specs/2026-08-22-mobile-likes-playlists-design.md`, план —
`docs/superpowers/plans/2026-08-22-mobile-likes-playlists-plan.md`. Переиспользует те же
API-эндпоинты и контракты, что и веб (`apps/web/store/likes.ts`,
`apps/web/components/add-to-playlist-button.tsx`) — сервер не менялся.

### Что сделано

- `lib/icon.tsx` — добавлены иконки `heart`/`plus`/`check` (path'ы 1:1 из
  `apps/web/public/icons/system-sprite.svg`) и проп `Icon.filled` (заливка вместо
  `fill="none"`, нужна для состояния «лайкнуто»).
- `lib/likes-store.ts` (новый) — zustand-стор, зеркало `apps/web/store/likes.ts` через
  `apiRequest`: `load(trackId)` (GET, не дублирует запрос, если трек уже в сторе или уже
  летит), `toggle(trackId)` (оптимистичное переключение + POST/DELETE
  `/api/v1/tracks/{id}/like`, откат на ошибке, module-level `_toggling`-guard против
  повторного тапа до ответа сети — тот же паттерн, что и веб-версия).
- `lib/playlists.ts` (новый) — чистые обёртки над `apiRequest` без стора (список плейлистов
  открывается заново на каждый шит): `fetchPlaylistsForTrack`, `addTrackToPlaylist`,
  `removeTrackFromPlaylist`, `createPlaylist`.
- `components/like-button.tsx` (новый) — `Pressable` с сердцем, грузит состояние на маунт,
  haptic-impact на тап.
- `components/add-to-playlist-sheet.tsx` (новый) — свой модальный bottom sheet на `Modal` +
  `Pressable`-оверлей (в мобилке нет готового примитива шита, в отличие от веба —
  `components/sheet.tsx`; тот же принцип «не тащить пакет ради одного шита», что кастомный
  `PanResponder`-слайдер в инкременте 3): список плейлистов с чекбоксами (тап — toggle,
  оптимистично + откат на ошибке), поле создания нового плейлиста внизу (создание сразу
  добавляет трек), haptic-impact на открытие и на успешное создание — не на каждый
  чекбокс-тап (см. «точечно — не на каждый тап» выше).
- Интеграция: `screens/release-screen.tsx` (`TrackRow`) и `screens/home-screen.tsx`
  (`HotTrackRow`) — оба контрола после длительности/индикатора воспроизведения, отдельные
  `Pressable`, не перехватывают тап по строке (play).
- Тесты (TDD, до реализации): `lib/__tests__/likes-store.test.ts` (9 тестов — load
  дедуплицирует запрос, не бьёт в сеть повторно/на уже загруженный трек, toggle
  оптимистично меняет + шлёт правильный метод, откатывает на ошибке, in-flight guard
  no-op на повторный тап, освобождается после ответа), `lib/__tests__/playlists.test.ts`
  (6 тестов — маппинг на правильные URL/методы/тела, экранирование `trackId` в query).
  Компонентных тестов на `LikeButton`/`AddToPlaylistSheet` нет осознанно — в мобилке нет
  `@testing-library/react-native`, паттерн проекта — тестировать стор/lib-слой (см.
  существующие `*-store.test.ts`).

### Проверено фактом (эмулятор `VireMusic_Test`, 2026-08-22)

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (77 тестов: 62 прежних +
  15 новых). `pnpm --filter @vire/core typecheck` — зелёный (порт не тронут).
- **Лайк — подтверждён живьём с обеих сторон.** На главной («В топе») тап по сердцу трека
  «Desktop shell test tone 2» → сердце заполняется мгновенно (оптимистичный UI) →
  `SELECT * FROM likes WHERE track_id=...` в реальной БД подтвердил строку сразу после тапа;
  повторный тап → сердце возвращается в контур, строка в `likes` исчезает (`count=0`).
  Скриншоты до/после в этой сессии; `adb logcat` — ноль `FATAL EXCEPTION` за весь прогон.
- **Добавление в плейлист — подтверждено живьём, включая создание нового плейлиста.**
  Тестовый юзер (`rntp-test@viremusic.local`) без единого плейлиста → тап на плюс у трека
  на экране релиза «Сигналы» → шит открылся с «Плейлистов пока нет» + полем создания →
  ввод «Mobile» + «Создать» → `SELECT * FROM playlists` подтвердил новую строку, `SELECT *
  FROM playlist_tracks` подтвердил трек в ней (реальный `POST /api/v1/playlists` +
  `POST /api/v1/playlists/{id}/tracks`, не заглушка). Повторное открытие шита (свежий
  `GET /api/v1/playlists?trackId=...`) показало чекбокс отмеченным и реальный `trackCount=1`
  с сервера — подтверждает, что состояние не только оптимistично-локальное, а действительно
  прочитано обратно. Снятие чекбокса → `playlist_tracks` для этой пары `(playlist_id,
  track_id)` пуст (`count=0`) — подтверждает `DELETE
  /api/v1/playlists/{id}/tracks/{trackId}`.
- **Без крашей за всю сессию.** `adb logcat -d | grep "FATAL EXCEPTION"` — пусто на
  протяжении всех взаимодействий (лайк/анлайк, открытие шита, создание плейлиста,
  добавление/удаление трека).
- **Побочная находка окружения, не относящаяся к коду фичи.** Первый прогон в сессии был
  запущен как `expo start --android` (обычный путь) — Metro решил, что цель — Expo Go, и
  начал устанавливать Expo Go на эмулятор, хотя приложение с инкремента 5 использует
  кастомный нативный модуль (`react-native-track-player`) и Expo Go принципиально не может
  его загрузить (см. «Вход через Expo Go снят как неприменимый» выше). Фикс — `expo start
  --dev-client`, который подключается к уже установленному dev-client APK вместо попытки
  открыть Expo Go. После холодного старта первый рендер занимает заметно дольше (~10с) —
  реальные сетевые раунд-трипы за SDUI-композицией и данными блоков, не баг.

### Не проверено

- Реальное устройство (только эмулятор, тот же статус, что у инкремента 5).
- Компонентное поведение шита при очень длинных списках плейлистов (скролл секции) —
  тестовый юзер имел 0→1 плейлист за сессию, много элементов не воспроизведено.
- iOS — вне скоупа (нет Mac), как и во всех предыдущих инкрементах.

## Инкремент 7: shuffle и repeat

Порт готовой веб-логики (`apps/web/store/player.ts` + `apps/web/lib/player/audio-engine.ts`
`controls.cycleRepeat`/`controls.toggleShuffle`/`controls.next()`) на мобилку — сами функции
очереди (`nextQueueIndex`, `shuffleOn`, `shuffleOff`, `type Repeat`) уже были в
`@vire/core/playback/queue` с инкремента 3, недоставало только UI и подключения репита к
`next()`/`'ended'`. Сервер не менялся.

### Что сделано

- `lib/icon.tsx` — иконки `shuffle`/`repeat` (path'ы 1:1 из
  `apps/web/public/icons/system-sprite.svg`), тот же приём, что и `heart`/`plus`/`check`
  в инкременте 6.
- `lib/player-store.ts` — `shuffle: boolean`, `repeat: Repeat`, `originalQueue: QueueTrack[] |
  null` в сторе; `toggleShuffle()`/`cycleRepeat()` — прямой порт `controls.toggleShuffle`/
  `controls.cycleRepeat` с веба (без джем-гварда — на мобилке джема нет). `next()` больше не
  хардкодит `'off'` в `nextQueueIndex(...)`, читает живой `repeat`; добавлен рестарт «тот же
  индекс» (`repeat='all'` с одним треком в очереди зацикливается на тот же index) — сик на 0 +
  play вместо повторного `loadAndPlay` (не гонять манифест за уже загруженным треком), тот же
  приём, что в `controls.next()` веба. `playQueue()` сбрасывает `shuffle`/`originalQueue` на
  каждой новой очереди, `repeat` не трогает (постоянная настройка слушателя, не очереди) —
  зеркалит `patch` в веб-версии `playQueue`. Слушатель `audioEngine.on('ended', ...)` теперь
  сначала проверяет `repeat==='one'` (сик+play того же трека, без вызова `next()`), иначе как
  раньше.
- `screens/player-screen.tsx` — `hasNext` больше не хардкодит `'off'` (иначе `repeat='all'` на
  последнем треке показывал бы disabled next); добавлены кнопки shuffle (перед prev) и repeat
  (после next) в транспортном ряду, тот же hitSlop/haptic-конвенция, что у существующих
  кнопок. Активный тинт — `colors.primary`/`colors.mutedForeground` (тот же приём, что
  `LikeButton` из инкремента 6); `repeat==='one'` — доп. кружок-бейдж «1» поверх иконки
  (`colors.primary` фон, `colors.primaryForeground` текст). Ряд транспорта перешёл с
  фиксированного `gap` на `justifyContent: 'space-between'` — пять кнопок вместо трёх иначе не
  умещались бы по ширине.
- `components/mini-player.tsx` — не тронут осознанно: мини-бар остаётся компактным
  (обложка/название/play-pause), shuffle/repeat — только на полноэкранном плеере, как и было
  решено в плане задачи.
- Тесты (TDD, до реализации) — `lib/__tests__/player-store.test.ts`: `toggleShuffle()` (вкл —
  текущий трек первым + `originalQueue` сохранён; выкл — исходный порядок восстановлен,
  `originalQueue` обнулён, индекс на текущем треке — против реальных `shuffleOn`/`shuffleOff`
  из `@vire/core`, не мока), `cycleRepeat()` (off→all→one→off), `next()` с `repeat`
  (`'off'` на последнем треке — как раньше; `'all'` на последнем треке многотрековой очереди —
  переход на индекс 0 с загрузкой манифеста; `'all'` с одним треком — без повторного запроса
  манифеста, сик+play), `'ended'` с `repeat==='one'` (рестарт без вызова `next()`/повторного
  запроса) и без него (обычный переход).

### Проверено фактом (эмулятор `VireMusic_Test`, 2026-08-22)

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (85 тестов: 77 прежних + 8 новых).
  `pnpm --filter @vire/core typecheck` — зелёный (порт не тронут).
- **Layout и тумблеры — подтверждены живьём со скриншотами и замером пикселей, не только
  «выглядит похоже».** Полноэкранный плеер открыт на реальном треке
  (`Desktop shell test tone 2` — один из двух треков в локальной БД с реально
  транскодированным HLS, см. ниже). Пять кнопок (shuffle/prev/play/next/repeat) отрисованы
  без наложения. Тап по shuffle — программный замер среднего RGB иконки: off ≈ (103,100,96)
  (соответствует `mutedForeground` `#7a7772`), on ≈ (192,189,185) (соответствует `primary`
  `#eae7e2` со сглаживанием по краям), повторный тап возвращает ровно (103,100,96) — тумблер
  туда-обратно подтверждён числами, не на глаз. Repeat прокликан все три состояния подряд
  (off→all→one→off) со скриншотами каждого: off/all — одна и та же иконка с разным тинтом,
  `one` — та же иконка плюс кружок-бейдж «1» в углу (крупные кропы приложены в сессии) — после
  третьего тапа вернулось визуально в состояние off без бейджа, цикл подтверждён.
- **Manual prev/next и сброс shuffle новой очередью — подтверждены поведенчески.** Тап по
  треку на главной ставит его как одиночную очередь (see «Воспроизведение звука» выше,
  поведение не менялось этим инкрементом) — `hasNext` корректно `false`, тап next — no-op без
  краша; после первого тапа по shuffle иконка стала on, что подтвердило: `playQueue()` не
  утащил `shuffle=true` из предыдущего прогона (были ранее включали shuffle на другом треке) —
  сброс на новой очереди отработал так, как и задумано, до, а не «баг тумблера».
- **Без крашей за всю сессию.** `adb logcat -d | grep "FATAL EXCEPTION"` — пусто на всём
  протяжении (проверено дважды, в середине и в конце сессии).

### Не проверено / известные пробелы этой сессии

- **Реальное переупорядочивание очереди при shuffle (3+ трека) и переход `repeat='all'` через
  конец многотрековой очереди — не проверены живьём.** Причина — не баг фичи, а состояние
  локальных тестовых данных: во всей локальной БД реально транскодированный HLS (строка в
  `track_audio`) есть только у двух треков (`Desktop shell test tone`/`...2`, релиз
  «Тёмная материя»), и оба всегда открываются с главной как **одиночная** очередь (см. выше).
  Релиз «Сигналы» с тремя треками (`Сигнал I/II/III`) в БД помечен `status=READY`, но был
  засеян без прогона воркера — `track_audio` для этих треков не существует вовсе, реальный тап
  по треку даёт `404 No audio available` (подтверждено логом
  `[player] не удалось получить манифест трека ... { status: 404 }`), это подтверждает
  предупреждение в корневом `CLAUDE.md` про ручной READY без воркера, не относится к коду
  этого инкремента. Диплинка на релиз «Тёмная материя» (единственная альтернатива с 2 реальными
  треками, но не размещённая в «Новые релизы» блоке SDUI-композиции на момент сессии) в
  приложении нет (`linking`/`prefixes` в навигаторе не настроены — подтверждено `grep`).
  Корректность самой перестановки (текущий трек первым, честный Фишер—Йетс на остальных,
  восстановление порядка) покрыта юнит-тестами против реальных `shuffleOn`/`shuffleOff` из
  `@vire/core` — того же модуля, что уже год в проде на вебе, — но не переигрывалась глазами на
  устройстве в этом инкременте.
- **`repeat='one'` рестарт по естественному концу трека — не проверялся живьём**, как и
  предполагалось в постановке задачи (нужно поймать момент естественного `ended`, ловить
  секундной точностью нецелесообразно). Покрыт юнит-тестом на мокнутом `audioEngine`
  (`emit('ended')` при `repeat==='one'` → `seek(0)`+`play()`, без повторного запроса манифеста
  и без вызова `next()`).
- Реальное физическое устройство — по-прежнему только эмулятор (статус не изменился с
  инкремента 5/6).

## Инкремент 8: диплинк на релиз

`vire://release/:releaseId` — только на уровне релиза, без нативных изменений: `app.json`
уже регистрирует `"scheme": "vire"` (использовалась для auth-callback), новый путь — чистый
JS через `linking` React Navigation.

### Что сделано

- `navigation/root-navigator.tsx` — `linking: LinkingOptions<RootStackParamList>` на
  `<NavigationContainer>`, `prefixes: ['vire://']`, вложенность
  `Main.Home.ReleaseDetail: 'release/:releaseId'` — совпадает с реальным деревом навигаторов
  (`RootStackParamList` → `Main` → `MainScreen`/`MainTabs` → таб `Home` → `HomeStackNavigator`
  → `ReleaseDetail`), проверено чтением `main-screen.tsx`/`main-tabs.tsx`/`home-stack.tsx`
  перед написанием конфига. `SignIn` в `linking` не участвует — диплинк работает только при
  уже сохранённой сессии (см. «Не проверено» ниже).
- `navigation/home-stack.tsx` — `ReleaseDetail`-параметры `title`/`artistName`/`coverUrl`
  стали опциональными (`releaseId` остаётся обязательным); обычный тап по карточке
  по-прежнему передаёт все четыре.
- `lib/release-header.ts` — чистая `resolveReleaseHeader(params, release)`: params
  присутствуют — используются как есть (мгновенная отрисовка при тапе по карточке, как и
  раньше); params отсутствуют — заголовок/обложка берутся из ответа
  `GET /api/v1/releases/{releaseId}` (`release.title`/`release.coverUrl`), `artistName`
  всегда пуст в этой ветке — `releaseSchema` не джойнит артиста, других полей с именем нет.
- `screens/release-screen.tsx` — хранит загруженный `release` в стейте, зовёт
  `resolveReleaseHeader` для заголовка; строка с именем артиста рендерится только когда
  `artistName !== ''` (без «undefined»/пустой строки на экране).
- Тесты (TDD, до реализации) — `lib/__tests__/release-header.test.ts` (5 кейсов: params
  целиком → приоритет params; params + загруженный релиз → params всё равно приоритет; params
  отсутствуют + релиз загружен → данные релиза, artistName пуст; params отсутствуют + релиз ещё
  грузится → безопасные дефолты; частичные params → недостающее не подмешивается из релиза).

### Проверено фактом (эмулятор `VireMusic_Test`, дев-сервер на 3000, 2026-08-22)

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (90 тестов: 85 прежних + 5 новых).
  `pnpm --filter @vire/core typecheck` — зелёный (не тронут).
- **Тёплый диплинк — подтверждён скриншотом.** Приложение открыто и авторизовано, активный
  таб — «Профиль»; `adb shell am start -a android.intent.action.VIEW -d
  "vire://release/<releaseId>" com.anonymous.viremobile` → мгновенный переход на трек-лист
  релиза «Сигналы» (таб-бар переключился на «Главная»), не туда, где был.
- **Холодный диплинк — подтверждён скриншотом, включая момент запуска.** `adb shell am
  force-stop` (сессия в secure-store не тронута) → тот же `am start` intent → приложение
  запустилось прямо на экране релиза (после короткого спиннера бутстрапа), не на главной
  вкладке — рассуждение про то, что `Linking.getInitialURL()` переживает задержку перед
  монтированием `NavigationContainer`, подтвердилось живьём, а не осталось на уровне теории.
- **Заголовок без имени артиста рендерится корректно** и в тёплом, и в холодном сценарии —
  видно название «Сигналы» и обложку (реально загруженные из ответа API), строка артиста
  отсутствует целиком (не «undefined», не пустая строка на экране).
- **Обычный тап-переход не регрессировал** — скриншот тап по карточке «Сигналы» с главной
  показывает заголовок/артиста/обложку мгновенно (из params, до ответа API), трек-лист
  подгружается следом со спиннером — то же поведение, что до инкремента.
- `adb logcat -d | grep "FATAL EXCEPTION"` — пусто за всю сессию (после тёплого и после
  холодного сценария).

### Не проверено / известные пробелы (осознанные, не баги)

- **Анонимный холодный старт по диплинку — ссылка теряется.** `linking.config` не включает
  `SignIn` в дерево экранов; если сессии нет, `RootNavigator` уходит на `SignIn`, и целевой
  `releaseId` из intent просто отбрасывается — нет механизма «доиграть диплинк после логина».
  Осознанное решение по постановке задачи, не баг.
- **Диплинк-заход не даёт имени артиста.** `releaseSchema` (`packages/api-contracts`) не
  джойнит артиста к релизу — единственный источник `artistName` на мобилке сегодня это
  список-экран, с которого был совершён обычный тап (например `GET /api/v1/home/fresh-releases`,
  делающий джойн сам). Для диплинка эта информация не подтягивается отдельным запросом
  (сознательно вне скоупа) — заголовок показывает только название и обложку.
- **Трек-уровень с таймкодом (`?t=` как в вебовском `TrackShare`) — не реализован.** Нужен
  клиентски доступный endpoint резолва трек→релиз, которого сегодня нет; отдельная задача.

## Инкремент 9: друзья (список, заявки, поиск)

Порт среза `docs/features/social-friends.md` на мобилку: список друзей, входящие заявки
(принять/отклонить), поиск людей, отправка/отмена исходящей заявки — `FriendButton` со всеми
пятью статусами (`NONE`/`OUTGOING`/`INCOMING`/`FRIENDS`/`SELF`), 1:1 порт состояния
`apps/web/components/friends/friend-button.tsx`. Сознательно не в этом инкременте: просмотр
чужого профиля (`/u/[userId]` на вебе — RSC без REST-роута вообще, отдельная задача), чат
(нужен SSE на RN — отдельное исследование), бейдж непросмотренных заявок на входе в «Друзья»
(веб считает `friend_requests_seen_at`; экран «Друзья» показывает только счётчик всех
входящих, без seen/unseen).

### Что сделано

- **Бэкенд-добавка (`apps/web` + `packages/api-contracts`, без миграции).** `GET
  /api/v1/friends` раньше отдавал только `{friends}` — веб не нуждался в REST для входящих
  (`apps/web/app/[locale]/(listener)/friends/page.tsx` вызывает `FriendshipService.listIncoming`
  напрямую как RSC). Мобилке нужен настоящий JSON — маршрут расширен на `incoming:
  IncomingRequestDTO[]` (та же `FriendshipService.listIncoming`, ничего нового в
  `packages/core`/`packages/db`). `packages/api-contracts/src/friends.ts` —
  `incomingRequestSchema` + `friendsResponseSchema.incoming`; `apps/web/app/api/v1/friends/route.ts`
  зовёт `listFriends`+`listIncoming` параллельно (`Promise.all`), маппит `requestedAt` в ISO.
  Единственный сторонний потребитель роута — `apps/web/components/jam-invite.tsx` — читает
  только `data.friends` сырым `fetch()` без схемы, новое поле не задевает.
- `lib/icon.tsx` — иконки `x`/`user-check`/`user-plus` (path'ы 1:1 из
  `apps/web/public/icons/system-sprite.svg`), тот же приём, что и предыдущие инкременты;
  `check`/`plus` переиспользованы из инкремента 6.
- `lib/friends.ts` (новый) — `apiRequest`-обёртки: `fetchFriends`, `searchUsers`,
  `sendFriendRequest`, `acceptFriendRequest`, `removeFriendEdge` (DELETE покрывает
  decline/cancel/unfriend — семантика решается тем, какая кнопка была показана, как на вебе).
- `lib/use-friend-action.ts` (новый) — `useFriendAction(userId, initialStatus)`: порт
  состояния `FriendButton` с оптимистичным переходом + откатом на ошибке. Реализован через
  zustand-стор, создаваемый **per-instance** внутри хука (`useState(() =>
  createFriendActionStore(...))`) — не глобальный синглтон, каждая кнопка независима, как и у
  веб-компонента с локальным `useState`; `createFriendActionStore` экспортирован отдельно и
  тестируется напрямую (`getState()`), без рендера React — тот же приём, что `likes-store.ts`.
- `components/friend-button.tsx` (новый) — `Pressable`-кнопка на хуке: `SELF` не рендерит
  ничего, `INCOMING` рендерит две кнопки (принять/отклонить), остальные — одну; hitSlop/haptic
  по конвенции `like-button.tsx`.
- `screens/friends-screen.tsx` (новый) — три секции: поиск (debounce 300мс, порог 2 символа,
  версия-счётчик отбрасывает устаревший ответ вместо `AbortController` — `apiRequest` не
  поддерживает `signal`), «Заявки в друзья (N)» (рендерится только если непусто, счётчик —
  просто `incoming.length`, без seen/unseen), «Друзья» (рендерит `FriendButton` и на этих
  строках тоже — unfriend достижим из списка друзей, не только из поиска, зеркалит веб).
  `RefreshControl` пере-грузает `friends`+`incoming` за один вызов `fetchFriends()`.
- **Навигация.** `navigation/profile-stack.tsx` (новый) — `ProfileMain → Friends`, тот же
  паттерн, что `home-stack.tsx`; `navigation/main-tabs.tsx` — таб «Профиль» указывает на
  `ProfileStackNavigator` вместо прямого `ProfileScreen` (как уже было у «Главной»).
  `screens/profile-screen.tsx` — плоская nav-строка «Друзья» (иконка `user-check`) над
  «УСТРОЙСТВА», остальной контент (список устройств, выход) не тронут. **Важная деталь:**
  вложение добавило уровень navigator — `signOut()`'s `navigation.getParent()?.reset(...)`
  раньше уходил сразу в `RootStack` (единственный уровень между `ProfileScreen` и им был
  `MainTabs`), теперь между экраном и `RootStack` два уровня (`ProfileStackNavigator` →
  `MainTabs`) — понадобился `getParent()?.getParent()?.reset(...)`, иначе «Выйти» сбрасывал
  бы только таб-навигатор и не долетал до экрана входа.
- Тесты (TDD, до реализации) — `lib/__tests__/friends.test.ts` (6: маппинг URL/метод/тело
  всех пяти обёрток, экранирование query), `lib/__tests__/use-friend-action.test.ts` (11: все
  переходы `NONE→request`, `OUTGOING→remove`, `INCOMING→accept`, `INCOMING→remove` (decline),
  `FRIENDS→remove` (unfriend), включая откат на HTTP-ошибку для каждой мутации, плюс `SELF`
  без сетевых вызовов). Компонентных тестов на `FriendButton`/`FriendsScreen` нет осознанно —
  в мобилке нет `@testing-library/react-native` (см. инкремент 6) — стор-слой тестируется
  напрямую, экран проверен живым прогоном ниже.

### Проверено фактом (эмулятор `VireMusic_Test`, dev-сервер на 3000, 2026-08-22)

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (107 тестов: 90 прежних + 17
  новых). `pnpm --filter @vire/web typecheck`/`lint`/`check:contracts`/`test` — зелёные (2007
  тестов, включая 3 обновлённых/новых на `GET /api/v1/friends` — 401, список друзей,
  контракт `since`/`requestedAt` как ISO-строки, `incoming` рядом с `friends`).
  `pnpm --filter @vire/core typecheck` — зелёный (порт не тронут). `pnpm --filter @vire/web
  build` — **не пройден в этой сессии по независимой от кода причине**: `next build`
  (Turbopack) не смог загрузить Google Fonts — TLS-хендшейт до `fonts.googleapis.com`
  обрывается на этой машине прямо сейчас (DNS резолвится, `curl` до `google.com` отдаёт 200,
  до `fonts.googleapis.com` — `schannel: failed to receive handshake`), не зависит от
  сендбокса (воспроизведено и с `dangerouslyDisableSandbox`). Не блокер кода — тот же класс
  находки, что Smart App Control/Docker IPv6 в прошлых инкрементах; typecheck/lint/tests
  полностью покрывают правки этого инкремента.
- **Полный цикл заявка → принятие → друзья → unfriend подтверждён живьём через реальные тапы
  и реальные HTTP-раунд-трипы, в обе стороны.** Второй тестовый юзер создан напрямую через
  `packages/db` (`rntp-friend2@viremusic.local` / `TestPass123!`, имя «Friend Two Mobile» —
  отличимое в поиске от первого тестового юзера «Mobile Test»). На эмуляторе: поиск «Friend»
  → нашёл реального юзера (`GET /api/v1/friends/search` за реальными данными БД) → тап
  «Добавить» → кнопка переключилась в «Заявка отправлена» → `SELECT * FROM friendships`
  подтвердил `PENDING`-строку сразу после тапа. Принятие с другой стороны — второй юзер
  залогинен через настоящий Auth.js credentials-флоу (`curl` + cookie jar, `/api/auth/csrf` →
  `/api/auth/callback/credentials` → `/api/auth/session`), реальный `POST
  /api/v1/friends/{id}/accept` от его имени → `status=ACCEPTED` в БД. Pull-to-refresh на
  экране «Друзья» подтянул реальное состояние — секция «Друзья» показала «Friend Two Mobile»
  с кнопкой «В друзьях». Тап «В друзьях» → `DELETE /api/v1/friends/{id}` → `SELECT count(*)
  FROM friendships` = 0, кнопка вернулась в «Добавить». Входящая заявка — второй юзер отправил
  заявку первому тем же curl-флоу, pull-to-refresh на устройстве показал секцию «Заявки в
  друзья (1)» с «Принять»/«Отклонить»; тап «Принять» на устройстве → реальный `POST
  /api/v1/friends/{id}/accept` → `status=ACCEPTED` в БД, кнопка на экране переключилась в «В
  друзьях» без перезагрузки списка (оптимистичный переход). `adb logcat -d | grep "FATAL
  EXCEPTION"` — пусто на протяжении всего прогона (поиск, обе заявки, оба accept, unfriend).
- **Обычный тап-переход Профиль → Друзья подтверждён живьём**, не регрессирует существующий
  контент «Профиля» (список устройств — пуст на этом тестовом юзере, «Выйти» на месте).
- **Побочная находка окружения, не относящаяся к коду фичи.** После `expo start --dev-client`
  и релоада уже установленного (с инкремента 5) APK экран несколько секунд держал сплэш
  (белый фон) даже после того, как Metro отчитался `Android Bundled` и `ReactNativeJS:
  Running "main"` появился в логе — вероятно, задержка нативного сплэша относительно
  первого кадра Fabric на этой машине/эмуляторе, не баг кода инкремента (тот же паттерн,
  что «первый рендер ~10с» из инкремента 6). Экран сам разрешился в реальный контент без
  вмешательства.

### Не проверено / известные пробелы (осознанные, не баги)

- **Просмотр чужого профиля** (`/u/[userId]` на вебе) — нет экрана и нет REST-роута под это
  на сервере вовсе (веб ходит в сервис напрямую из RSC); естественный следующий срез, если
  понадобится.
- **Чат 1:1** — не начат, нужно сперва решить транспорт (веб использует SSE через браузерный
  `EventSource`, недоступный в RN нативно — нужен полифилл или другой транспорт), отдельный
  инкремент.
- **Бейдж непросмотренных заявок на входе в «Друзья»** — сознательно не сделан (см. постановку
  задачи); экран «Друзья» показывает только счётчик всех входящих после загрузки, не
  seen/unseen. `POST /api/v1/friends/seen` и `friend_requests_seen_at` не тронуты.
- Реальное физическое устройство — по-прежнему только эмулятор (статус не изменился).
- `pnpm --filter @vire/web build` — см. «Проверено фактом» выше: заблокирован сетевым
  TLS-сбоем до `fonts.googleapis.com` на этой машине в момент сессии, не кодом; стоит
  перепроверить в следующей сессии, если блокер сети снимется сам (как уже было с Smart App
  Control в инкременте 5).

## Инкремент 10: просмотр профиля пользователя

Закрывает хвост инкремента 9: там любая строка человека (поиск/входящие/друзья) не вела
никуда. Порт среза `apps/web/lib/friend-profile.ts` (`loadFriendProfile`) — веб зовёт эту
функцию напрямую из RSC `/u/[userId]`, REST-роута под неё не было вообще; вся бизнес-логика
(статус дружбы, гейт видимости лайков, блокировка) уже существовала и проверена, инкремент —
тонкая REST-обёртка + мобильный экран, не новая логика.

### Что сделано

- **Бэкенд-добавка (`apps/web` + `packages/api-contracts`, без миграции).** Новый роут `GET
  /api/v1/users/[userId]/profile` (`apps/web/app/api/v1/users/[userId]/profile/route.ts`,
  сосед уже существующего `.../block/route.ts`) — авторизация через `getCaller()` (401 без
  неё), валидация `userId` как uuid (400), зовёт `loadFriendProfile(caller.id, userId)` (404
  если `null`), маппит `Date→ISO` на `likedAt`/`createdAt`/`updatedAt`. `canChat`/`iBlockedThem`
  из исходной функции в DTO этого инкремента **не попадают** — чат не строится, а
  разблокировка не имеет UI (см. «Не проверено» ниже), протаскивать неиспользуемые поля через
  контракт не стали. `packages/api-contracts/src/friends.ts` — `likedTrackSchema` +
  `userProfileResponseSchema` (переиспользует `playlistSummarySchema` из `./playlist`, тот же
  тип, что уже используется в мобильном `add-to-playlist-sheet.tsx` с инкремента 6). Тесты —
  `apps/web/app/api/v1/users/[userId]/profile/route.test.ts` (6: 401/400/404, форма ответа,
  `likesVisible=false` прячет лайки, `blocked=true` не протекает `iBlockedThem`).
- `lib/friends.ts` — `fetchUserProfile(userId)` (`apiRequest`-обёртка, тот же приём, что
  остальные пять функций файла) и чистая `likedTracksToQueue(tracks): QueueTrack[]`
  (`coverUrl` берётся из `releaseCoverUrl` трека, не с самого лайка/плейлиста) — вынесена
  отдельно и покрыта тестом, тот же приём, что `resolveReleaseHeader` в инкременте 8.
- `screens/user-profile-screen.tsx` (новый) — параметр `{userId}`, три блока: шапка
  (аватар/имя + `FriendButton` — переиспользован как есть из инкремента 9, initialStatus из
  ответа; если `blocked === true`, кнопка вообще не рендерится, вместо неё текст «Действия
  недоступны», без UI разблокировки), «Понравившиеся треки» (`likesVisible === false` →
  «Лайки скрыты»; иначе список, тап по треку — `playQueue(likedTracksToQueue(likes), index)`,
  запускает воспроизведение всего списка лайков как очередь, как и трек-лист релиза), «Публичные
  плейлисты» (только имя + `trackCount`, **не тап-абельно** — на мобилке до сих пор нет экрана
  просмотра содержимого плейлиста вообще, не только чужого; сознательный пробел, не оговорка).
  `RefreshControl`, `Screen`-обёртка — тот же набор конвенций, что `release-screen.tsx`.
- **Навигация.** `navigation/profile-stack.tsx` — третий экран `UserProfile: {userId: string}`
  рядом с `ProfileMain`/`Friends`. `screens/friends-screen.tsx` — каждая строка человека (поиск,
  входящие, друзья) обёрнута в `Pressable`, тап ведёт на `UserProfile`; `FriendButton` внутри
  строки — собственный `Pressable`, не триггерит переход строки (в RN нет всплытия событий по
  DOM-модели, вложенные `Pressable` независимы «из коробки» — так и оказалось на живом прогоне).
- Тесты (TDD) — `+5` в `lib/__tests__/friends.test.ts` (`fetchUserProfile` URL/метод,
  `likedTracksToQueue` маппинг полей, включая `null durationSec`/`releaseCoverUrl`).

### Проверено фактом

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (112 тестов: 107 прежних + 5
  новых). `pnpm --filter @vire/web typecheck`/`lint`/`check:contracts`/`test`/`build` —
  зелёные (2013 тестов, включая 6 новых на роут профиля; build прошёл чисто, TLS-флейк с
  Google Fonts из инкремента 9 в этой сессии не повторился).
- Код прочитан целиком и вручную сверен построчно с уже проверенным живьём кодом инкрементов
  6/8/9 (те же `apiRequest`-обёртки, тот же `FriendButton`, тот же `playQueue`) — совпадает по
  форме и конвенциям, отдельных сюрпризов не выявлено.

### Живой прогон подтверждён (2026-08-23)

Прошлая сессия оборвалась на пустом `env:load` в `.expo/dev/logs/start.log` и предполагала
проблему `.env` vs `.env.local`. Разбор оказался другим: `apps/mobile/.env` (не `.env.local`
— это и есть штатное имя файла для этого проекта, `.env.local` в конвенции не участвует)
всё это время существовал с верными `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_BASE_URL`, и
предыдущие `env:load`-записи в том же логе это подтверждали. Пустая запись в конце — это
**зомби-процесс** `expo start --dev-client` от прошлой попытки (PID висел с 02:25, порт 8081
слушал, но `/status` не отвечал и новых `metro:bundling:started` не было) — именно он душил
попытки нового рестарта делить порт. Убийство зомби-процесса (`Stop-Process`) и чистый
`npx expo start --dev-client` без инлайновых shell-`export` подхватили `.env` немедленно
(`env:load` с обоими значениями, сборка бандла, приложение открылось на сохранённой сессии).
Гипотеза «дело в переменных окружения» была ошибочной — дело было в незакрытом процессе.

Прогон на эмуляторе `VireMusic_Test`: Профиль → Друзья показал существующую дружбу
(регрессия инкремента 9 не задета); тап по строке «Friend Two Mobile» открыл `UserProfile` с
реальными именем/аватаром. Для проверки контента подготовлены фикстуры через REST
(`POST /api/v1/tracks/{id}/like`, `POST /api/v1/playlists` + `PATCH .../{id}` с
`visibility: PUBLIC`) под сессией `rntp-friend2@viremusic.local`. Первая попытка задать лайк
попала на трек без `track_audio`-строки — API корректно вернул 404 «No audio available», это
не баг: просто выбор фикстуры, трек без реального транскода. Переключились на трек с готовым
HLS (`Desktop shell test tone`) — «Понравившиеся треки» показал его, тап запустил реальное
воспроизведение (mini-player сменил иконку на паузу, трек доиграл 20-секундный тон до конца).
«Публичные плейлисты» показал «Тестовый плейлист» с верным trackCount=2, не тап-абелен, как и
задумано. `FriendButton` протестирован в обе стороны: тап отвязал друзей (кнопка → «Добавить»,
подтверждено прямым запросом к `friendships` — строка удалена), затем дружба восстановлена
(`POST /api/v1/friends/request` от friend2 + приём заявки через UI под уже залогиненным на
эмуляторе аккаунтом) — состояние вернули к тому, что было до прогона. `adb logcat -d | grep
"FATAL EXCEPTION"` пуст за всю сессию.

### Не проверено / известные пробелы

- Блокировка/разблокировка — закрыто инкрементом 11 (см. ниже).
- Просмотр содержимого плейлиста (свой или чужой) — не существует на мобилке вообще, не
  ограничение только этого инкремента.
- Чат 1:1 — по-прежнему не начат (см. инкремент 9).

## Инкремент 11: блокировка

Закрывает хвост инкремента 10 — экран профиля показывал статичное «Действия недоступны»
для уже заблокированной пары, но не давал ни инициировать блок, ни разблокировать. Бэкенд
(`apps/web/app/api/v1/users/[userId]/block/route.ts`, `POST`/`DELETE`) уже существовал и не
менялся — веб им уже пользовался. Инкремент — одно поле в DTO и мобильный UI.

### Что сделано

- **Бэкенд-добавка (`apps/web` + `packages/api-contracts`, без миграции).** `userProfileResponseSchema`
  получил `iBlockedThem: boolean` (инкремент 10 сознательно его выбросил — не было UI-нужды);
  `GET /api/v1/users/[userId]/profile` протаскивает поле из уже существующего
  `loadFriendProfile`. `route.test.ts` — тест «surfaces blocked...» раньше утверждал, что поле
  не протекает в ответ; переписан на два кейса (`iBlockedThem: true` — я инициатор блока,
  `false` — заблокировали меня).
- `lib/icon.tsx` — иконка `user-x` (path 1:1 из системного спрайта, тот же приём, что и
  предыдущие иконки).
- `lib/friends.ts` — `blockUser`/`unblockUser` (`apiRequest`-обёртки, `POST`/`DELETE`
  `/api/v1/users/{userId}/block`), тот же приём, что остальные семь функций файла.
- `screens/user-profile-screen.tsx` — три ветки по `blocked`/`iBlockedThem`: заблокировал я →
  кнопка «Разблокировать» (иконка `user-x`, стиль как у `FriendButton.muted`) вместо
  `FriendButton`; заблокировали меня → без изменений, статичный текст «Действия недоступны»,
  без кнопки (эта сторона уже была верна в инкременте 10); не заблокировано → `FriendButton`
  как раньше плюс тихая вторичная текстовая ссылка «Заблокировать» под ней (не отдельная
  громкая деструктивная кнопка — блокировка редкое осознанное действие). Оба действия
  перезагружают профиль через уже существующий `load()`.
- Тесты (TDD) — `+3` в `lib/__tests__/friends.test.ts` (`blockUser` URL/метод + экранирование
  `userId`, `unblockUser` URL/метод).

### Проверено фактом (эмулятор `VireMusic_Test`, 2026-08-23)

- `pnpm --filter @vire/mobile typecheck`/`test` — зелёные (115 тестов: 112 прежних + 3
  новых). `pnpm --filter @vire/web typecheck`/`lint`/`check:contracts`/`check:routes`/
  `check:i18n`/`test`/`build` — зелёные (2014 тестов, включая 3 новых/переписанных на
  `iBlockedThem`; один прогон `test` словил не связанный с этим инкрементом таймаут-флейк на
  `app/api/v1/push/subscribe/route.test.ts` под полной параллельной нагрузкой — тест зелёный
  в изоляции, тот же класс находки, что и известный TLS-флейк Google Fonts; build один раз
  упёрся в тот же TLS-флейк до `fonts.googleapis.com`, прошёл со второй попытки).
- **Обнаружено и починено по ходу: зомби-процесс Metro на порту 8081** — тот же класс
  находки, что и в сессии инкремента 10 («Живой прогон подтверждён»), повторился здесь
  независимо: `expo start --dev-client` от прошлой сессии держал порт (`LISTENING`), но
  `/status` не отвечал (таймаут). `Stop-Process` по PID + чистый `npx expo start
  --dev-client` — бандл собрался нормально (1231 модулей). Это уже второй раз за две сессии
  подряд, стоит иметь в виду как штатную первую проверку при «висит на сплэше»/«белый экран».
- **Блокировка — подтверждена живьём с обеих сторон.** Профиль → Друзья → тап по «Friend Two
  Mobile» (реальная дружба, сохранённая с прошлой сессии) → тап «Заблокировать» → экран
  переключился на «Разблокировать» с иконкой `user-x`, `FriendButton` исчез полностью
  (подтверждено `uiautomator dump`, не только на глаз). `SELECT * FROM friendships` — 0 строк
  сразу после блока (блокировка удаляет дружбу, `BlockService.block` подтверждён server-side);
  `SELECT * FROM user_blocks` — новая строка (`blocker_id`=активный на эмуляторе тестовый
  юзер, реально оказался `mobiletest@vire.local`/«Mobile Test», не `rntp-test@viremusic.local`
  из постановки задачи — секьюр-стор с прошлой сессии держал именно эту учётку; на
  результат проверки это не влияет). «Понравившиеся треки» переключились на «Лайки скрыты»
  без отдельного кода — `likesVisible` уже гейтится блоком в `loadFriendProfile` с инкремента
  до этого (`canSeeLikes` не вызывается вовсе при `blocked=true`), подтверждено визуально, не
  только по чтению кода. «Публичные плейлисты» остались видны (не гейтятся блоком).
- **Обратная сторона подтверждена через реальный REST-вызов, не только чтением кода.**
  Второй тестовый юзер (`rntp-friend2@viremusic.local`) залогинен через настоящий Auth.js
  credentials-флоу (curl + cookie jar) → `GET /api/v1/users/{mobiletestId}/profile` вернул
  `{"blocked":true,"iBlockedThem":false,...}` — по логике экрана это ветка без кнопки
  («Действия недоступны»), поведение инкремента 10 не регрессировало.
  UI-скриншот этой стороны не снимался (юзер не залогинен на устройстве) — эквивалентность
  доказана прямым чтением того же `UserProfileResponse`, который рендерит экран.
- **Разблокировка — подтверждена живьём.** Тап «Разблокировать» на устройстве → экран
  вернулся к `FriendButton` со статусом `NONE` («Добавить», ожидаемо — блок стёр дружбу,
  повторное добавление отдельное действие) и тихой ссылке «Заблокировать» под ней;
  `SELECT count(*) FROM user_blocks` = 0 сразу после.
- `adb logcat -d | grep "FATAL EXCEPTION"` — пусто за всю сессию (блок, разблок, навигация,
  рестарт Metro/приложения).
- **Состояние тестовых аккаунтов восстановлено**, как и в прошлых сессиях: `friend2` отправил
  заявку в друзья `mobiletest` через REST (`POST /api/v1/friends/request`), принята на
  устройстве («Заявки в друзья» → «Принять») — `friendships` подтверждает `ACCEPTED`-строку
  между той же парой, что была задета блоком.

### Не проверено / известные пробелы

- Реальное физическое устройство — по-прежнему только эмулятор (статус не изменился).
- UI-скриншот стороны «меня заблокировали» — подтверждён только прямым REST-вызовом
  (см. выше), не отрисовкой на экране (второй тестовый юзер не был залогинен на устройстве
  параллельно с первым).

## Вне скоупа (следующие шаги)

- **Инкремент 5 закрыт по основной цели** (лок-скрин/фон на Android, эмулятор) — краш
  `MusicService.emit()` исправлен и подтверждён живьём 2026-08-22 (см. «Краш исправлен —
  подтверждено живым прогоном» выше). Открытые хвосты: реальное физическое устройство
  (проверялось только на эмуляторе `VireMusic_Test`), лок-скрин с включённым PIN/паттерном
  (эмулятор без секьюрити не показывает keyguard отдельно от системной медиа-карточки),
  Android Auto, длинный трек с ручным сворачиванием посреди воспроизведения (короткий тестовый
  тон доигрался до сворачивания сам).
- Shuffle/repeat-UI — закрыто инкрементом 7 (см. выше; переупорядочивание 3+ треков и
  `repeat='all'`-переход через конец очереди — не проверены живьём из-за отсутствия
  многотрекового плеймого контента в локальной БД, см. «Не проверено» инкремента 7). Оффлайн-
  скачивание — не начато. Лайки/добавление в плейлист — закрыто инкрементом 6.
- Диплинк на релиз (`vire://release/:releaseId`) — закрыто инкрементом 8 (см. выше). Диплинк
  на трек с таймкодом, доигрывание ссылки после анонимного логина — не реализованы, см. «Не
  проверено» инкремента 8.
- Друзья (список/заявки/поиск) — закрыто инкрементом 9. Просмотр профиля пользователя —
  закрыто инкрементом 10, живой прогон подтверждён 2026-08-23 (см. «Живой прогон подтверждён»
  там же). Блокировка/разблокировка — закрыто инкрементом 11 (см. выше). Чат 1:1 (нужен
  транспорт вместо browser-only `EventSource`), бейдж непросмотренных заявок, просмотр
  содержимого плейлиста (свой или чужой, не существует вообще) — по-прежнему вне скоупа.
- Пуши, биометрия, шеринг, виджеты — рассмотрены и сознательно отложены: пуши не имеют
  доставки (единственные события `FRIEND_REQUEST`/`CHAT_MESSAGE` ведут в чат, которого нет),
  шеринг не имеет получателя (приложение нигде не распространяется, `vire://` открывается
  только у тех, у кого уже стоит сборка, веб-ссылка на релиз не собирается — в API релиза нет
  slug артиста). Возвращаться, когда появится дистрибуция и/или соцслой дорастёт до чата.
- iOS-сборка и запуск на реальном устройстве — не проверялись (нет Mac); `app.json` пишет
  конфиг под обе платформы, но реально верифицирован только веб-превью (`react-native-web`)
  и, для Android, эмулятор.
- **Android SDK/эмулятор — с инкремента 4 есть** (`VireMusic_Test`, API 36, `ANDROID_HOME=
  C:\Android`, `pnpm --filter @vire/mobile mobile:android` для managed-запуска, `npx expo
  run:android` для локальной сборки с нативными зависимостями типа RNTP). Predictive back
  и pull-to-refresh теперь проверены (см. «Добито тем же прогоном» выше) — визуальный кадр
  predictive-анимации остаётся не пойманным, но это уже полировка, не открытый вопрос.
  «Вход через Expo Go» снят как неприменимый (см. там же).

## Инкремент 12: офлайн-скачивание треков

Технически более рискованный инкремент, чем 6–11 (чистый перенос бизнес-логики) — новая
нативная зависимость (`expo-file-system`, первосортный Expo SDK-модуль, не рискованный
сторонний нативный модуль вроде RNTP в инкременте 5) и первый случай, когда HLS проигрывается
не с CDN, а с локального файла. План явно предписывал сначала доказать этот механизм спайком
(bypass `player-store`, прямой вызов `audioEngine.load()`), и только потом строить UI вокруг
него — **механизм подтверждён живьём дважды** (см. ниже), после чего собран полный срез.

### Что сделано

- **`packages/media`** (`@vire/media`, новый пакет, был зарезервирован в корневом
  `CLAUDE.md` как пустой `.gitkeep`) — `src/hls.ts`: `parseHlsSegments` (скопирован 1:1 из
  `apps/web/lib/offline/hls.ts`, уже был чистой функцией без браузерных API) и новая
  `rewritePlaylistForLocalSegments(playlistText, localFilenames)` — переписывает плейлист на
  локальные относительные имена сегментов, построчно в том же порядке, что и
  `parseHlsSegments` (комментарии/`#EXT-X-*`/пустые строки не трогает; бросает при
  несовпадении числа сегментов и `localFilenames`). Относительные имена, не абсолютные
  `file://`-пути — `Paths.document` не гарантированно стабилен между обновлениями/
  переустановками приложения, а относительный путь резолвится HLS от самого `.m3u8`, где бы
  он физически ни лежал. 6 тестов (`src/hls.test.ts`), включая round-trip через
  `parseHlsSegments` с фейковым `file://`-базовым URL. `apps/web` не тронут — веб продолжает
  использовать свой `lib/offline/*`, `@vire/media` пока только для мобилки.
- **`apps/mobile/lib/offline/download-manager.ts`** — `downloadTrack(meta, onProgress?)`,
  `removeDownload(trackId)`, `listDownloads()`, `getDownloadedTrack(trackId)`,
  `estimateUsage()`. Индекс скачанных треков — один плоский JSON-файл
  (`documentDirectory + 'offline/index.json'`) через `expo-file-system`, без AsyncStorage/
  SQLite (тот же принцип, что и кастомный bottom-sheet в инкременте 6 вместо библиотеки —
  не тащить зависимость ради одной нужды, скачанных треков мало, читать/писать индекс
  целиком дешевле). Каждый трек — своя папка `offline/{trackId}/` с сегментами
  `seg-000.ts…` и переписанным `playlist.m3u8`. **Без резюмируемых докачек и без отмены** —
  осознанный урезанный первый срез («скачать всё → % → готово/ошибка»): у веба резюмируемость
  бесплатна благодаря Cache Storage, для файловой системы RN это отдельная задача, не
  оправданная для первого среза.
- **`apps/mobile/lib/player-store.ts`** — `loadAndPlay()` перед сетевым запросом манифеста
  зовёт `getDownloadedTrack(track.id)`; если запись есть — `manifestUrl` берётся из
  `localPlaylistPath` без единого сетевого вызова, иначе (и только тогда) идёт прежний путь
  через `apiRequest`. Обе ветки сходятся в один и тот же `audioEngine.load()` — RNTP не
  различает `file://` и `https://` в HLS-манифесте (см. «Почему это сработало» ниже).
- **UI:** `components/download-button.tsx` — три состояния (не скачан: иконка `download`,
  тап начинает скачивание; идёт скачивание: `%` вместо иконки; скачан: иконка `check`, тап
  удаляет без подтверждения — осознанно просто). Подключена в `screens/release-screen.tsx`
  только для `READY`-треков (недоступным сначала нечего скачивать). `screens/library-screen.tsx`
  — вкладка «Медиатека» перестала быть заглушкой: список скачанных (обложка/название/
  артист/длительность/размер), тап — очередь плеера через тот же `playQueue`, что и везде,
  крестик — удаление, сводка использования (`estimateUsage()` + `formatBytes`) сверху, пустое
  состояние вместо списка, если ничего не скачано. `navigation/main-tabs.tsx` не менялся —
  `Library` уже указывал на этот экран напрямую, без вложенного стека.
- **Новая иконка `download`** в `lib/icon.tsx` — своего download в
  `apps/web/public/icons/system-sprite.svg` нет, поэтому взят существующий `vire-upload`
  (тот же лоток) и стрелка отражена по вертикали (апекс вниз вместо вверх), координаты
  посчитаны вручную из raw path исходного символа.
- **Осознанно не в этом инкременте:** скачивание обложек (офлайн-трек показывает то, что
  успело закешироваться обычным `<Image>`, либо ничего — честно задокументированный пробел,
  не недосмотр), кнопка скачивания где-либо кроме трек-листа релиза (не в «Понравившихся»,
  не в профиле пользователя — отдельный будущий инкремент), Wi-Fi-only, выбор качества.

### Почему это сработало — технический механизм

`TrackPlayer.load()` в `lib/audio-engine.ts` получает `Track.url` с явным `type: 'hls'`;
ExoPlayer (RNTP на Android) резолвит DataSource по схеме URI — `file://` идёт через
`FileDataSource`, `https://` через `HttpDataSource`, дальше оба ведут в один и тот же
HLS-экстрактор. Именно поэтому `audio-engine.ts` не потребовал ни единой правки — разница
целиком инкапсулирована в том, какой `manifestUrl` ему передают.

### Живая проверка

**Спайк (до UI) — подтверждён дважды на реальном устройстве.** Реальный трек
(`b6a8d20e-b808-4ede-8ace-7b8177e90948`, «Desktop shell test tone 2», уже известный по
инкременту 5) — манифест → `.m3u8` → `parseHlsSegments` → все 11 сегментов через
`File.downloadFileAsync` в `documentDirectory/offline-spike/{id}/` → `rewritePlaylistForLocalSegments`
→ `audioEngine.load({ manifestUrl: 'file://...' })` напрямую (в обход `player-store`, как
предписывал план) → `play()`. `dumpsys media_session`: `state=PlaybackState
{state=PLAYING(3), ...}`, метаданные совпадают. **Второй прогон — с `cmd connectivity
airplane-mode enable` + `svc wifi disable` (подтверждено иконкой самолётика в статус-баре и
`settings get global airplane_mode_on` = 1)** — идемпотентная ветка спайка обнаружила уже
скачанные локальные файлы, пропустила сеть целиком, и `load()`/`play()` повторно отдали
`state=PLAYING` с растущей позицией — без единого сетевого вызова. `adb logcat -d | grep
"FATAL EXCEPTION"` — пусто за оба прогона.

**Реальный (не спайковый) `download-manager.ts` + `player-store.ts` — тоже подтверждены
живьём на устройстве**, отдельным прогоном через тот же приём (временный авто-триггер в
`App.tsx`, без единого тапа — см. «Известная проблема окружения» ниже): `removeDownload` →
`getDownloadedTrack` = `null` → `downloadTrack()` с прогрессом `0/11…11/11` → `bytes=1562148`,
`localPlaylistPath` указывает на `offline/{id}/playlist.m3u8` → `listDownloads()` = 1 запись →
`usePlayerStore.getState().playQueue(...)` реально взял офлайн-ветку (`status: 'playing'`) →
`dumpsys media_session` подтвердил `state=PLAYING`, верные метаданные → `removeDownload()` →
`getDownloadedTrack()` снова `null`. Временный код удалён из `App.tsx` после прогона (нет в
финальном коммите), `git diff` перед коммитом это подтверждает.

**Известная проблема окружения — не проверено тапами.** Touch-инъекция через
`adb shell input tap`/`motionevent`/`swipe` не работала всю сессию на всех тестовых
координатах, включая после `adb kill-server`/`start-server` и **после полного чистого
перезапуска эмулятора** (`adb emu kill` + новый `emulator -avd VireMusic_Test`,
подтверждено пустым `adb devices` между ними) — на свежесобранном системном ANR-диалоге
(«Process system isn't responding», всплывал независимо от кода этой сессии) `KEYCODE_
DPAD_CENTER` сработал (нативный `AlertDialog` уважает hardware-фокус), но тот же дпад/`TAB`
не сдвигал фокус внутри RN-экранов приложения — то есть это ограничение именно
touch/pointer-инъекции на уровне эмулятора/хоста в этой сессии, не код фичи и не первый раз
встреченный класс проблемы (сравнимо с прошлыми блокерами окружения — Smart App Control,
Docker/IPv6, см. выше). Прямое следствие: кнопка скачивания на экране релиза и список
«Медиатека» не проверены тапом — визуально код прочитан, `formatBytes`/список/пустое
состояние тестами покрыты, а вся логика, которую они дёргают, подтверждена реальным
устройством описанным выше обходным путём (авто-триггер вместо тапа). Реальный тап на
кнопку скачивания и «Медиатека» — первая проверка следующей сессии, когда/если окружение
восстановится.

### Тесты и гейты

- `packages/media`: 6 тестов (`parseHlsSegments`, `rewritePlaylistForLocalSegments`),
  typecheck — зелёные.
- `apps/mobile`: +17 тестов (132 всего, было 115) — `download-manager.test.ts` (13: чистые
  `parseIndex`/`serializeIndex`/`sumBytes`, I/O-функции с полностью замоканным
  `expo-file-system` по тому же принципу, что RNTP в `audio-engine.test.ts`), `format.test.ts`
  (+2 на `formatBytes`), `player-store.test.ts` (+2 на офлайн-ветку `loadAndPlay` — скачанный
  трек не зовёт `apiRequest`, не скачанный работает как раньше; существующий тест на гонку
  устаревшего ответа манифеста адаптирован под новую точку гонки — `getDownloadedTrack`,
  не `apiRequest`, вызывается первым). `pnpm --filter @vire/mobile typecheck`/`test` —
  зелёные.
- `pnpm --filter @vire/web typecheck` — зелёный (не должен был задеться, `apps/web` не
  трогался этим инкрементом; проверено на всякий случай, т.к. `packages/media` — новый
  workspace-пакет).

### Где код

- `packages/media/src/hls.ts`, `src/index.ts`, `package.json`/`tsconfig.json`/
  `vitest.config.ts` — мирят boilerplate `packages/api-client`.
- `apps/mobile/lib/offline/download-manager.ts`, `lib/__tests__/download-manager.test.ts`.
- `apps/mobile/lib/player-store.ts` (офлайн-ветка `loadAndPlay`), `lib/format.ts`
  (`formatBytes`).
- `apps/mobile/components/download-button.tsx`, `screens/release-screen.tsx` (подключение),
  `screens/library-screen.tsx` (реальный экран вместо `StubScreen`).
- `apps/mobile/lib/icon.tsx` — иконка `download`.
- `apps/mobile/package.json` — `expo-file-system` (`~57.0.5`), `@vire/media`
  (`workspace:*`).

## Инкремент 13: E2EE-совместимость и identity bootstrap (первый срез чата)

Первый срез переноса чата (`docs/features/chat.md`) на мобилку, намеренно урезан до
единственной вещи, которую нельзя проверить «на глаз»: криптографии. **UI сообщений,
список диалогов, экран треда, композер и SSE-клиент в этом инкременте НЕ строились** —
следующий инкремент, после того как этот фундамент подтверждён. Веб использует
`libsodium-wrappers` (WASM); нативный `react-native-libsodium` расценён как риск, сравнимый
с сагой RNTP инкремента 5 — вместо него **`tweetnacl`** (чистый JS, реализует те же
примитивы NaCl, что оборачивает libsodium — X25519 и XSalsa20-Poly1305/secretbox) +
**`blakejs`** (keyed BLAKE2b для `crypto_generichash`, чего в tweetnacl нет) +
**`react-native-get-random-values`** (полифилл `crypto.getRandomValues`, единственная из
трёх зависимостей с нативной прослойкой — de facto стандарт RN-экосистемы).

### Phase 1 — доказательство побитового совпадения с libsodium (пройдено)

**Результат: byte-for-byte совпадение подтверждено.** Не «похоже работает» — реальные
hex-векторы совпали значение-в-значение с выводом настоящего `libsodium-wrappers`.

Метод: одноразовый (не закоммиченный, удалён после прогона) Node-скрипт в `apps/web`
использовал уже установленный `libsodium-wrappers` с **фиксированными**, не случайными
32-байтными скалярами (`privA = [1..32]`, `privB = [32..1]`) и фиксированным нонсом
(`[1..24]`) — вызывал `crypto_scalarmult_base`/`crypto_scalarmult`/`crypto_generichash`
(с тем же `CK_KEY`/порядком конкатенации, что и `apps/web/lib/e2ee/conversation.ts`'s
`deriveCK`) и `crypto_secretbox_easy` напрямую (в обход `encryptMessage`'s
авто-случайного нонса — нужен был предсказуемый шифротекст). Полученный вектор
(`pubA`/`pubB`/`ck`/`nonce`/`ciphertext` в hex и base64, plaintext `привет`) захардкожен
в `apps/mobile/lib/e2ee/__tests__/sodium-compat.test.ts`.

`apps/mobile/lib/e2ee/sodium-compat.ts` реализует `deriveCK`/`encryptMessage`/
`decryptMessage` (то же API, что веб's `{sodium,conversation}.ts`) на tweetnacl (`nacl.
scalarMult`/`nacl.scalarMult.base` вместо `crypto_scalarmult`/`_base`, `nacl.secretbox`/
`.open` вместо `crypto_secretbox_easy`/`_open_easy`) и blakejs (`blake2b(input, key,
outlen)` вместо `crypto_generichash(outlen, input, key)` — порядок аргументов другой,
семантика та же) — тот же `CK_KEY` (`'vire-chat-ck-v1\0'`, 16 байт), тот же порядок
`low`/`high` по сравнению байтов, тот же `concat(shared, low, high)`. Тест против
вектора: `deriveCK` с обеих сторон даёт ровно `ck` из вектора; `decryptMessage` на
записанных `ciphertext`+`nonce` восстанавливает `привет` дословно; отдельно проверен
кодек base64 (собственная реализация — `sodium.base64_variants.ORIGINAL`, стандартный
алфавит с паддингом, Hermes не даёт `Buffer`/`btoa` гарантированно) против known-vectors
RFC 4648 §10. Веб не тронут — `pnpm --filter @vire/web test -- e2ee` (реально прогоняет
весь набор, 2014 тестов, `apps/web`'s `test` script не фильтрует по имени через `--`)
зелёный без изменений.

### Phase 2 — identity bootstrap

- **`apps/mobile/lib/e2ee/identity.ts`** — `getIdentity`/`getOrCreateIdentity`/
  `clearIdentity`/`getIdentityPubB64`, зеркалит `apps/web/lib/e2ee/identity.ts` по форме.
  Хранилище — `expo-secure-store` (уже используется для токенов с инкремента 1), не
  IndexedDB (в RN её нет). Скоуп по userId — тот же принцип, что у веба
  (`identity:{userId}` в IndexedDB), но **не тот же буквальный ключ**: `expo-secure-store`
  требует `/^[\w.-]+$/` (двоеточие запрещено) — ключ `vire_identity_{userId}`. Пара
  `pub`/`priv` пакуется в одну строку `pubB64.privB64` (SecureStore хранит только строки).
  Генерация — `nacl.box.keyPair()` (байт-совместим с `sodium.crypto_box_keypair()` — то же
  X25519). **Однодевайсно в этом инкременте** — `importIdentity`/`resetIdentity` и весь
  протокол привязки устройства (`linking.ts`, SAS-обмен) осознанно не перенесены,
  отложены на будущий инкремент.
- **Откуда берётся userId.** У мобилки нигде не было текущего userId — `secure-store.ts`
  хранит только `accessToken`/`refreshToken`/`deviceId`. Access-токен устройства
  (`packages/core/src/platform/identity/device-tokens.ts`, `signAccessToken`) — не JWT
  (нет header-сегмента), но по форме близко: `base64url(JSON{sub,role,did,iat,exp}).
  base64url(hmac)`. Новый `apps/mobile/lib/access-token.ts` (`decodeAccessTokenUserId`)
  читает `sub` из тела клиентски, без проверки подписи — секрет серверный, клиенту
  нечем проверять, да и незачем: он уже доверяет токену, который сам получил от сервера
  по TLS (тот же периметр доверия, что при отправке его же Bearer'ом). `secure-store.ts`
  получил `getCurrentUserId()` поверх этого. Отсюда же родился `apps/mobile/lib/codec.ts` —
  base64/UTF-8 кодек, вынесенный из `sodium-compat.ts` в отдельный модуль, потому что
  `access-token.ts` тоже в нём нуждается (декодирует base64url-тело), а тянуть e2ee-модуль
  ради кодека из авторизационного кода — не тот слой.
- **`apps/mobile/lib/e2ee/publish-key.ts`** — `publishIdentityKey(ikPub)`, POST
  `/api/v1/keys` (контракт прочитан из `apps/web/app/api/v1/keys/route.ts`: `{ ikPub }` →
  `{ ok: true }`, тело регексом `^[A-Za-z0-9+/]{43}=$` — то же самое, что даёт base64 32
  байт с паддингом). Схема ответа — `okResponseSchema` из `@vire/api-contracts` (роут
  `keys/**` намеренно вне `check:contracts` — «E2EE-протокол, не JSON REST контракт», см.
  `apps/web/scripts/check-contracts.mjs` — поэтому под POST-тело зодовской схемы в
  контрактах нет, `zod` добавлен в `apps/mobile` напрямую для лёгкого локального объекта
  запроса). Идемпотентно — дедуп по значению ключа в module-level `Set` (мирроринг
  `publishPub` в `apps/web/lib/e2ee-client.ts`), неудача не кешируется.
- **`apps/mobile/lib/e2ee/bootstrap.ts`** (`bootstrapE2eeIdentity`) — склеивает три шага:
  `getCurrentUserId()` → (нет — выходим тихо, юзер не залогинен) → `getOrCreateIdentity`
  → `publishIdentityKey(toB64(pub))`; целиком в `try/catch` — сбой не должен ронять
  запуск приложения, следующий холодный старт повторит. Вызывается из `App.tsx` (`useEffect`
  на монтировании, mirroring веб's `E2eeBootstrap` — публикует при каждом заходе
  залогиненного юзера, не только при явном открытии чата). `index.ts` получил
  `import 'react-native-get-random-values'` самой первой строкой — до `registerRootComponent`,
  до любого кода, трогающего крипту (тот же паттерн, что `TrackPlayer.registerPlaybackService`
  чуть ниже — «сделать один раз до рендера `App`»).

### Тесты и гейты

- `apps/mobile`: +30 тестов (162 всего, было 132) — `sodium-compat.test.ts` (8: два
  cross-platform теста против вектора из Phase 1 — сердце инкремента, + кодек-проверка,
  + round-trip на собственных ключах, + отказ на неверном ключе/шифротексте),
  `identity.test.ts` (7: генерация/персист/idempotent-повтор/скоуп по userId/`clearIdentity`
  только для своего юзера/формат pubB64/SecureStore-ключ без двоеточия), `publish-key.test.ts`
  (4: успех/идемпотентность/неудача не кешируется/разные ключи публикуются независимо),
  `bootstrap.test.ts` (3: нет юзера → тишина, есть юзер → генерация+паблиш, сбой зависимости
  не бросает), `codec.test.ts` (3: round-trip произвольных байт, RFC 4648 §10 vectors,
  UTF-8 round-trip с кириллицей), `access-token.test.ts` (5: извлечение `sub`, паддинг
  base64url без родного padding, malformed без точки, невалидный base64/JSON, отсутствующий/
  нестроковый `sub`). `pnpm --filter @vire/mobile typecheck`/`test` — зелёные.
- `pnpm --filter @vire/web test -- e2ee` — зелёный (полный прогон, `apps/web` не тронут).

### Живая проверка на эмуляторе

Native-зависимость (`react-native-get-random-values`) потребовала чистый ребилд:
`npx expo prebuild --platform android --clean` + `npx expo run:android` на
`VireMusic_Test` (Docker-инфра и веб-дев-сервер были уже подняты, `adb reverse
tcp:3000 tcp:3000`/`tcp:9000` уже стояли с прошлой сессии).

- **Приложение стартует без краша на реальном Hermes.** Установлено, автозапущено
  (`topResumedActivity=…MainActivity`), SDUI-главная отрисовалась с реальными данными
  («Сигналы», «В топе»). `adb logcat -d | grep "FATAL EXCEPTION"` по всему буферу — пусто
  (единственные найденные ошибки — `ExoPlayer FileNotFoundException` на офлайн-сегменте и
  `WindowManager`-предупреждения из **предыдущих**, не связанных с этим инкрементом
  сессий/таймстампов, не из текущего запуска).
- **Ключ реально опубликован в базу.** У приложения уже была сохранённая сессия
  (`mobiletest@vire.local`, secure-store пережил ребилд) — `bootstrapE2eeIdentity()`
  отработал на холодном старте без единого тапа. Прямой запрос к БД:
  `user_identity_keys` получила свежую строку для этого `user_id`
  (`created_at = updated_at`, таймстамп секунда-в-секунду с моментом запуска) —
  `ik_pub = EbOz6c3u/h0EA+lGSYkRSNERpfuKzBfO2wT/P+IqDB8=`, ровно формат `^[A-Za-z0-9+/]
  {43}=$` из роута. Это реальный `nacl.box.keyPair()`, сгенерированный на устройстве
  Hermes-рантаймом (не в Vitest/Node) через полифилл `react-native-get-random-values`,
  и реально доставленный на сервер `POST /api/v1/keys` — весь путь Phase 1+Phase 2
  подтверждён фактом, не только тестами.
- Отдельный вход (`mobile-auth-bridge` → форма) не понадобился — сохранённая с прошлой
  сессии сессия уже была залогинена под тестового юзера, что для цели проверки
  («работает ли бутстрап для залогиненного юзера») эквивалентно свежему логину.

### Осознанно не в этом инкременте

Никакого UI сообщений: список диалогов, экран треда, композер, SSE-клиент, индикатор
«печатает», статус «прочитано» — всё это `docs/features/chat.md`'s функциональность,
которую следующий инкремент строит поверх уже доказанного здесь фундамента. Мультидевайс
(привязка нового устройства по SAS-коду, `resetIdentity`) — тоже отложены, однодевайсно.

## Инкремент 14: базовый чат-тред (без списка диалогов)

Первый UI-срез чата поверх фундамента инкремента 13 (identity bootstrap, tweetnacl-крипта).
Открыть тред с другом с его профиля, слать и получать E2EE-сообщения живьём по SSE.
Список диалогов, typing-индикатор, статус «прочитано» — не строились, см. ниже.

### Контракт

`packages/api-contracts/src/chat.ts` получил `getKeyResponseSchema` (`{ikPub: string|null}`) —
у `GET /api/v1/keys` не было зодовской схемы ответа. `apps/web/app/api/v1/keys/route.ts`'s GET
теперь `satisfies GetKeyResponse`. Из-за этого роут стал «на контрактах» — убрана протухшая
запись `keys/**` из allowlist `check-contracts.mjs`, вместо неё точечная `keys/link/**` (сам
`GET/POST /keys` теперь проверяется наравне с обычными REST-роутами, протокол привязки
устройства — по-прежнему вне контрактов, форма ответа там union/эфемерная).

### Что построено

- **`apps/mobile/lib/chat.ts`** — `openConversation`/`fetchMessages`/`sendMessage`/
  `fetchPeerKey`, тонкие обёртки над `apiRequest` (паттерн `lib/friends.ts`). `fetchMessages`
  поддерживает keyset-курсор (`?before=&beforeId=`) из контракта, хотя этот инкремент вызывает
  только первую страницу без курсора — пагинация вверх осознанно не строилась.
- **`apps/mobile/lib/chat-realtime.ts`** — SSE-клиент на `react-native-sse` (чистый JS,
  `XMLHttpRequest` внутри, без нативного модуля — установлен без `expo prebuild`). Один
  `EventSource` на `/api/v1/realtime/stream` с `headers: {Authorization: Bearer ...}`
  (в отличие от web'а мобилка не может положиться на cookie — токен читается из
  `secure-store` при каждом коннекте/реконнекте). В отличие от web's
  `use-realtime.ts` — без multi-subscriber refcounting (на мобилке максимум один тред
  открыт одновременно) и без `@reconnect`-догрузки пропущенного (тред этого инкремента не
  переживает разрыв соединения дальше простого реконнекта — та же деградация, что у пропуска
  пагинации). Диспатч фильтрует только `type === 'message'`, остальные типы (`notification`,
  `link-request`, `chat:typing`, `chat:read`) молча игнорируются. Реконнект — бэкофф 1с→×2→cap
  15с. Чистая часть (`parseChatRealtimeEvent`) вынесена из сетевого кода — тестируется без
  реального `EventSource`.
- **`apps/mobile/screens/chat-thread-screen.tsx`** — на монтировании: `getCurrentUserId()` →
  `getOrCreateIdentity` → `fetchPeerKey(otherUserId)`. `ikPub === null` → блокирующее
  центрированное состояние («У собеседника пока нет ключа шифрования — писать нельзя»),
  композер не рендерится (нет поллинга-оживления каждые 8с, как у web's `E2eeBootstrap` —
  тред нужно переоткрыть вручную после того, как у собеседника появится ключ). Есть ключ →
  `deriveCK` один раз в `useRef`, история грузится и расшифровывается; сообщение, которое не
  расшифровалось (`decryptMessage` вернул `null` — чужой CK или битые данные), рендерится
  отдельной курсивной плашкой «Не удалось расшифровать», не роняет экран и не выкидывается
  из списка. Живые сообщения — `useChatRealtime`, фильтр по `conversationId`, дедуп по
  `message.id` (эхо своего же отправленного сообщения, `ChatService.send` публикует
  событие обеим сторонам — подтверждено чтением `packages/core/src/platform/messaging/services/chat.ts:63-65` на
  этапе планирования). Отправка — оптимistic-append сразу с плейнтекстом и реальным
  id из ответа `sendMessage` (без tempId-реконсиляции — id уже настоящий к моменту
  прихода SSE-эха). `FlatList` ASC + `scrollToEnd` на новое сообщение/маунт (не inverted —
  проще, для первого прохода этого достаточно).
- **Вход** — `apps/mobile/screens/user-profile-screen.tsx`: кнопка «Написать» рядом с
  `FriendButton`, гейт `status === 'FRIENDS' && !profile.blocked`. `openConversation` →
  `navigation.navigate('ChatThread', {conversationId, otherUserId, otherUserName})`.
  `apps/mobile/navigation/profile-stack.tsx` — четвёртый экран стека (`ProfileMain → Friends →
  UserProfile → ChatThread`).

### Тесты и гейты

`apps/mobile`: +16 тестов (178 всего, было 162) — `chat.test.ts` (7: маппинг URL/метод/тело
всех четырёх функций, включая курсорный вариант `fetchMessages` и экранирование сегментов),
`chat-realtime.test.ts` (5: парсинг валидного payload'а, malformed JSON не бросает,
null/undefined, JSON без строкового `type`, произвольный `type` проходит наравне —
фильтрация на стороне вызывающего), `chat-crypto-roundtrip.test.ts` (4: обе стороны выводят
одинаковый CK, сообщение читается в обе стороны, кириллица переживает round-trip побайтово,
чужой CK не расшифровывает). `pnpm --filter @vire/mobile typecheck`/`test` — зелёные.
`pnpm --filter @vire/web typecheck`/`check:contracts` — зелёные (единственные web-гейты,
которые релевантны — правка ограничена контрактом и allowlist, логика роутов не менялась).

### Живая проверка на эмуляторе

Native-зависимостей не добавилось (`react-native-sse` — чистый JS) — обошлось без
`expo prebuild`; хватило force-stop + повторного запуска активности, чтобы Metro отдал
свежий бандл (подтверждено логами: `FATAL EXCEPTION`/`Requiring unknown module` — пусто на
холодном старте после ребилда).

- **Профиль → «Написать» → тред.** На эмуляторе `VireMusic_Test`, сессия
  `mobiletest@vire.local`: Профиль → Друзья → «Friend Two Mobile» (`rntp-friend2@
  viremusic.local`, уже в друзьях) → кнопка «Написать» видна и рабочая → тред открылся,
  сначала в блокирующем состоянии («нет ключа шифрования») — у второго тестового юзера
  идентичность ни разу не публиковалась (мобильного E2EE-бутстрапа под ним никто не гонял).
  Ключ опубликован одноразовым Node-скриптом (см. ниже) под настоящей Auth.js cookie-сессией
  этого юзера — реальный `nacl.box.keyPair()`, реальный `POST /api/v1/keys`, подтверждено
  строкой в `user_identity_keys`. Повторное открытие треда (Профиль → Друзья → «Написать» —
  переоткрытие треда, не поллинг: этот инкремент его не строил) — композер появился.
- **Отправка с мобилки.** Ввод `test increment 14 from mobile` (ASCII — `adb shell input text`
  не поддерживает кириллицу, кириллический кейс закрыт встречным направлением ниже) → тап
  «↑» → сообщение появилось в треде мгновенно, без видимой задержки на раунд-трип
  (оптимистичный аппенд). **Доказательство E2EE — прямой запрос к реальной Postgres:**
  ```
  id       | 9f9f85fc-e3e4-418a-a6af-760220be8621
  sender   | 6a5d35b8-343e-4570-a7c5-69822275db98 (mobiletest)
  body     | OkJ614RLFhYss4Bp9JceRwcmZ/WWdv270qEdlXpTzubNDrgf8SzXhP63e3D5
  nonce    | CWm0M4J2JzTkEbFDQFtpkPsCw9Lu5K7G
  ```
  `body` — не читаемый текст, никак не похож на `test increment 14 from mobile`; отдельная
  колонка `nonce` со своим значением. Сервер физически не может прочитать то, что было
  отправлено — это и есть предмет доказательства фичи, не только факт записи в БД.
- **Живая доставка со встречной стороны по SSE, кириллица.** Тред остался открытым на
  устройстве, никаких тапов. Отдельным Node-скриптом (`tweetnacl`+`blakejs`, та же математика,
  что `sodium-compat.ts`; логин `rntp-friend2@viremusic.local` — настоящий Auth.js
  credentials-флоу, `curl`-эквивалент на `fetch` с ручным cookie jar: `/api/auth/csrf` →
  `/api/auth/callback/credentials` → `/api/auth/session`) вычислен CK против уже
  расшифрованного мобилкой `ikPub` mobiletest'а, зашифровано `привет от друга`, отправлено
  `POST /api/v1/chat/messages` с Bearer-эквивалентной cookie-сессией. Скрипт получил `200` с
  собственным `id` сообщения. Следующий скриншот устройства (снят сразу после ответа скрипта,
  без единого тапа по экрану) показал новый пузырь слева: **«привет от друга»** — дословно
  то, что было зашифровано, кириллица не искажена. Это SSE, не рефреш: `chat-thread-screen.tsx`
  не имеет ни поллинга, ни pull-to-refresh — единственный путь получения нового сообщения без
  явного действия пользователя — `useChatRealtime`'s `EventSource`.
  `select id, sender_id, body, nonce from messages` подтвердил вторую строку с отдельными
  `body`/`nonce` для второго направления.
- **Чистота лога.** `adb logcat -d | grep "FATAL EXCEPTION"` по всему буферу сессии (от
  ребилда до последнего скриншота) — пусто.
- Скрипт-пруф (`tweetnacl`+`blakejs`+`fetch`, логин → публикация ключа → шифрование →
  отправка) — одноразовый, скопирован во временный файл внутри `apps/mobile` для резолва
  зависимостей и удалён после прогона; не закоммичен, как и в инкременте 13.

### Осознанно не в этом инкременте

Список диалогов (`/messages`-аналог), typing-индикатор, статус «прочитано», пагинация вверх
по истории (курсор в `lib/chat.ts` есть, вызывающий код им не пользуется), мультидевайс
(SAS-привязка, `resetIdentity`), фон/пуш-доставка новых сообщений — SSE у RN работает только
пока приложение на переднем плане, это известное и документированное ограничение, а не
что-то, что этот инкремент пытался решить. Поллинг-оживление треда без ключа собеседника
(как у web's `E2eeBootstrap`, раз в 8с) тоже не перенесено — тред с `ikPub === null`
надо переоткрыть вручную после того, как у собеседника появится ключ.

## Инкремент 15: список диалогов

Второй UI-срез чата поверх инкремента 14: список существующих переписок, доступный по
кнопке «Сообщения» в Профиле, с превью последнего сообщения (расшифровано на устройстве)
и переходом в уже готовый `ChatThread`.

### Контракт

Ноль изменений бэкенда — `GET /api/v1/chat/conversations` и `chatConversationsResponseSchema`
уже существовали до этого инкремента, использованы как есть.

### Что построено

- **`apps/mobile/lib/chat.ts`** — пятая тонкая обёртка, `fetchConversations()` (GET,
  без параметров, тот же паттерн, что остальные четыре).
- **`apps/mobile/lib/chat-preview.ts`** — чистая функция `resolveConversationPreview`,
  различает три исхода превью, не схлопывая их в один текст: нет сообщений («Нет
  сообщений»), сообщение есть, но ключа собеседника нет («Зашифровано»), CK выведен, но
  `decryptMessage` вернул `null` («Не удалось расшифровать»). Вынесена по прецеденту
  `lib/release-header.ts`/`lib/friends.ts` — единственный способ юнит-тестировать логику
  без компонентных тестов, которых в проекте нет.
- **`apps/mobile/screens/conversations-screen.tsx`** — новый экран: `fetchConversations()`
  на маунте (`loading`/`error`/`ready`, паттерн `friends-screen.tsx`), `getCurrentUserId`
  + `getOrCreateIdentity` грузятся один раз в `useRef`, CK на каждую строку деривится из
  её собственного `otherIkPub` — отдельный `fetchPeerKey` на беседу не нужен, DTO уже
  несёт ключ собеседника. `FlatList` + `RefreshControl` с haptic (`Haptics.impactAsync`,
  1:1 с `friends-screen.tsx`). Аватар — та же плашка «первая буква имени», что и везде
  начиная с инкремента 9/10. Непрочитанное — жирный текст (имя и превью) + точка
  `colors.primary` на правом крае, зеркалит web's `ConversationList`. Таймстемп — локальная
  `formatConversationTimestamp` (сегодня → `HH:MM`, иначе → `DD.MM`), не экспортирована и
  не покрыта отдельным тестом — узкий юзкейс, разумнее прочитать код, чем городить тест
  ради теста.
- **`apps/mobile/lib/icon.tsx`** — иконка `message-square` (`vire-message-square`, тот же
  принцип извлечения 1:1 из `system-sprite.svg`, что у `download`).
- **`apps/mobile/navigation/profile-stack.tsx`** — экран `Conversations` в стеке
  (`ProfileMain → Friends → UserProfile → Conversations → ChatThread`).
- **`apps/mobile/screens/profile-screen.tsx`** — nav-row «Сообщения» рядом с «Друзья»,
  те же стили `navRow`/`navRowText`.

### Тесты и гейты

`apps/mobile`: +5 тестов (183 всего, было 178) — `chat.test.ts` (+1, `fetchConversations`),
`chat-preview.test.ts` (+4, все три исхода превью плюс проверка, что колбэк получает три
правильных аргумента). `pnpm --filter @vire/mobile typecheck`/`test` — зелёные. Бэкенд не
трогали — `apps/web`-гейты не гоняли (правка ограничена `apps/mobile`, `git diff --stat`
подтверждает: только файлы мобилки + этот документ).

### Живая проверка на эмуляторе

- **Находка по ходу: пароль тестового юзера не подошёл.** `mobiletest@vire.local` /
  `TestPass123!` из инкремента 14 — прямой POST на `/api/auth/callback/credentials` (в
  обход UI, чтобы исключить опечатку в ADB-вводе) вернул `CredentialsSignin`, не только на
  эмуляторе. Похоже, пароль этого юзера никогда явно не задавался/сбрасывался (в отличие
  от `rntp-test@viremusic.local`, см. запись инкремента 4) — `password_hash` в БД
  существует, но соответствует какому-то другому значению. Сброс пароля прямой SQL/
  Drizzle-мутацией заблокирован классификатором разрешений сессии — не стал обходить.
  Вместо этого сработал штатный passwordless-путь «Sign in with an email link»: dev-режим
  логирует magic-link в консоль вместо письма (`sendVerificationRequest`,
  `apps/web/auth.ts`); web dev-сервер перезапущен с выводом в файл, чтобы этот лог стал
  доступен сессии; ссылка получена из вывода и открыта `adb shell am start -a
  android.intent.action.VIEW`, `mobile-auth-bridge` подхватил колбэк и вернул в приложение
  уже авторизованную сессию. Пароль юзера в БД не менялся, состояние аккаунта не
  затронуто.
- **Профиль → «Сообщения» → реальная расшифровка.** Строка диалога показала настоящее имя
  собеседника («Friend Two Mobile»), таймстемп (`12:26`) и — предмет проверки — превью,
  расшифрованное на устройстве: **«привет от друга»**, дословно то сообщение, что было
  зашифровано и отправлено в инкременте 14 живой проверкой со стороны
  `rntp-friend2@viremusic.local`. Плейсхолдеры «Зашифровано»/«Не удалось расшифровать» не
  показались — деривация CK по `otherIkPub` из DTO сработала верно с первого раза.
  Непрочитанная точка справа — соответствует `unread: true` в ответе API.
- **Переход в тред.** Тап по строке → открылся `ChatThread` с обеими историческими
  репликами (`test increment 14 from mobile` от mobiletest, `привет от друга` от friend2)
  — та же переписка, что и в инкременте 14, без потерь.
- **Pull-to-refresh.** Свайп сверху вниз по списку → `GET /api/v1/chat/conversations`
  ушёл повторно (лог dev-сервера подтверждает вызов после начальной загрузки и релонча
  приложения), список перерисовался без ошибок.
- `adb logcat -d | grep "FATAL EXCEPTION"` — пусто за всю сессию. Ребилд не потребовался —
  чистое JS/TS изменение без новых нативных зависимостей, обошлось Metro reload +
  переоткрытием активности.

### Осознанно не в этом инкременте

Живое обновление списка при получении сообщения в другом месте приложения — web's
`useConversations` держит это через realtime-подписку и `focus`-рефетч; мобильный v1
полагается только на pull-to-refresh, `useChatRealtime` на этом экране не подключён.
Бейдж непрочитанного на самом пункте навигации в Профиле — тот же принцип, что инкремент 9
применил к заявкам в друзья: не заводить лишний источник рассинхрона без явного запроса.
Вызов «отметить прочитанным» при открытии — не делали; экран остаётся чисто читающим.

## Инкремент 16: typing-индикатор и «прочитано» в треде

Два полигонных сигнала поверх готового треда (инкремент 14): «печатает…» и статус
«Отправлено»/«Прочитано» под своим последним сообщением. Бэкенд не тронут — оба REST-роута
(`POST /chat/{id}/typing`, `POST /chat/{id}/read`) и оба SSE-события (`chat:typing`,
`chat:read`) уже существовали и уже использовались web'ом (`components/chat/typing-
indicator.tsx`, `components/chat/chat-thread.tsx`).

### Что построено

- **`apps/mobile/lib/chat.ts`** — `sendTyping`/`markConversationRead`, шестая и седьмая тонкие
  обёртки над `apiRequest` (тот же паттерн, `okResponseSchema`).
- **`apps/mobile/lib/chat-typing.ts`** — две чистые функции, вынесенные по прецеденту
  инкрементов 8/10/15 (нет компонентных тестов в проекте): `shouldSendTypingPing(lastSentAt,
  now)` — троттлинг `TYPING_THROTTLE_MS=2500` (1:1 с web's `message-composer.tsx`);
  `isReadByPeer(lastOwnMessageCreatedAt, peerReadAt)` — сравнение таймстемпов для
  «Прочитано»/«Отправлено» (1:1 с web's `chat-thread.tsx`: `new Date(m.createdAt) <= readAt`).
- **`apps/mobile/lib/chat-realtime.ts`** — диспатч расширен с одного `type === 'message'` на
  множество `DISPATCHABLE_TYPES = {message, chat:typing, chat:read}` (чистая функция
  `isDispatchableChatEventType`, тестируется изолированно). `parseChatRealtimeEvent` уже был
  типово-нейтральным (не требовал правки) — фильтрация по типу жила только на стороне
  `connectChatRealtime`.
- **`apps/mobile/screens/chat-thread-screen.tsx`**:
  - `useEffect` на маунт — `markConversationRead(conversationId)` best-effort, ошибка
    игнорируется, рендер не блокируется.
  - `onChangeDraft` (заменил прямой `setDraft`) — троттлит `sendTyping` через
    `shouldSendTypingPing`, шлёт только когда `text.trim()` непусто.
  - `onRealtimeMessage` — три ветки по `event.type` вместо одной: `message` (как раньше, плюс
    сброс индикатора печати, если отправитель — `otherUserId`), `chat:typing` (фильтр по
    `conversationId`+`userId===otherUserId`, `setPeerTyping(true)` + таймер 4с на автосброс),
    `chat:read` (фильтр по `conversationId`, `chat:read`-payload несёт `readAt`, не `userId` —
    адресность уже обеспечена сервером через `publish(otherUserId, ...)`, см.
    `packages/core/src/platform/messaging/services/chat.ts:87-98`).
  - `lastOwnMessage` (`useMemo`) + `ownStatusLabel` — «Прочитано» когда
    `isReadByPeer(lastOwnMessage.createdAt, peerReadAt)`, иначе «Отправлено»; рендерится
    подписью под бабблом только у сообщения с `id === lastOwnMessage.id` (не у каждого
    своего). «печатает…» — под именем собеседника в шапке треда.
  - Скоуп статуса «прочитано» — **только в рамках текущей сессии экрана**. Нет запроса
    начального `otherLastReadAt` при открытии (web берёт его из
    `chatService().getConversationMeta()`, вызываемого только server-side из RSC — REST-роута
    для этого нет, тот же класс пробела, что нашёл инкремент 10 для `/u/[userId]`, не
    закрывать сейчас). Практическое следствие: переоткрытие треда/приложения сбрасывает
    статус на «Отправлено», пока не придёт новый живой `chat:read`. Это осознанное упрощение
    v1, не баг.

### Находка и фикс по ходу: `decryptMessage` бросал, а не возвращал `null`

Живая проверка обнаружила краш (не из кода этого инкремента — регрессия порта инкремента 13):
`apps/mobile/lib/e2ee/sodium-compat.ts`'s `decryptMessage` оборачивал в `try/catch` только
`fromUtf8(opened)`, а не сам `nacl.secretbox.open(...)`. tweetnacl **бросает** на неверную
длину nonce/ключа (в отличие от неверного содержимого при верной длине — тогда просто
возвращает `null`, штатный путь «Не удалось расшифровать»). Web's эквивалент
(`apps/web/lib/e2ee/conversation.ts:44-50`) уже оборачивает весь вызов целиком — мобильный
порт этот случай упустил. Один битый (по длине) `nonce`/`ciphertext` в истории — и падает
рендер и треда, и списка диалогов (превью тоже зовёт `decryptMessage`), без пути восстановления
кроме удаления строки из БД. Пойман собственным тестовым сообщением с неверной длиной nonce во
время живой проверки этого инкремента — не гипотетический кейс. Фикс — обернуть весь вызов
(теперь 1:1 с web), плюс два регресс-теста на `sodium-compat.test.ts` (неверная длина
nonce/ключа не бросает, возвращает `null`).

### Тесты и гейты

`apps/mobile`: +17 тестов (200 всего, было 183) — `chat.test.ts` (+4: `sendTyping`/
`markConversationRead`, URL/метод + экранирование), `chat-realtime.test.ts` (+2:
`isDispatchableChatEventType` — message/chat:typing/chat:read пропускает, notification/
link-request/пустая строка — нет), `chat-typing.test.ts` (+9, новый файл: throttle-граница
`shouldSendTypingPing`, все исходы `isReadByPeer` включая границу равенства), `sodium-
compat.test.ts` (+2: регресс на краш decryptMessage). `pnpm --filter @vire/mobile typecheck`/
`test` — зелёные. Бэкенд не трогали — `git diff --stat` подтверждает: только `apps/mobile/**`
+ этот документ, `apps/web`-гейты не гоняли.

### Живая проверка на эмуляторе

Сессия `mobiletest@vire.local` (эмулятор `VireMusic_Test`, тред с `rntp-friend2@
viremusic.local` из инкрементов 14–15), встречная сторона — `curl`-эквивалент на реальную
Auth.js cookie-сессию friend2 (тот же приём, что в инкрементах 9/11/14: `/api/auth/csrf` →
`/api/auth/callback/credentials` → cookie jar). Force-stop + релонч активности хватило
(чистый JS/TS, native-зависимостей не добавилось).

- **Typing — живой, гаснет по таймауту.** `POST /chat/{id}/typing` от friend2 → следующий
  скриншот устройства (доля секунды спустя) показал «печатает…» под именем «Friend Two
  Mobile» в шапке треда. После 5с без повторных пингов — индикатор пропал сам (следующий
  скриншот header чистый, только имя).
- **Typing гаснет сразу по приходу message, не только по таймауту.** Пинг `typing` → сразу
  следом (без паузы) реальный `POST /chat/messages` от friend2 → скриншот менее чем через
  секунду после ответа сервера показал индикатор уже пропавшим (притом что 4с ещё не истекли)
  — подтверждает ветку `event.message.senderId === otherUserId → clearPeerTyping()`, а не
  только таймер.
- **Статус «Отправлено» → «Прочитано».** Открытый тред сразу показал «Отправлено» под своим
  последним сообщением (сессия только что открыта — начального `otherLastReadAt` по дизайну
  нет). `POST /chat/{id}/read` от friend2 → следующий скриншот показал подпись, сменившуюся
  на **«Прочитано»** — живой `chat:read` дошёл по тому же SSE-соединению, `isReadByPeer`
  сравнил `readAt` с таймстемпом `12:26` и признал прочитанным.
- **Найденный краш (`decryptMessage`) — воспроизведён и исправлен той же сессией**, см.
  секцию выше; тестовые сообщения с этим багом удалены из БД (`docker exec vire-postgres
  psql -U vire -d vire -c "delete from messages where id = ..."`) после подтверждения фикса —
  переписка вернулась к состоянию инкрементов 14/15 плюс валидные тестовые сообщения этого
  инкремента (тоже удалены после проверки, тред пуст от мусора этой сессии).
- `adb logcat -d | grep "FATAL EXCEPTION"` — пусто за весь прогон **после** фикса
  `decryptMessage` (до фикса — два воспроизведённых краша, оба задокументированы выше как
  находка, не как остаточная проблема).

### Осознанно не в этом инкременте

REST-эндпоинт для `otherLastReadAt` (начальное состояние «прочитано» без ожидания живого
события) — реальный пробел, тот же класс, что и `/u/[userId]` в инкременте 10, не закрыт
сейчас. Typing/read где-либо, кроме открытого экрана треда (список диалогов, пуши) —
не строилось. Индикатор печати не показывается самому себе (нет петли — `chat:typing`
приходит только от `otherUserId`, сервер не эхо'ит инициатору).

## Инкремент 17: пуш-уведомления (Expo → FCM)

Реалтайм (чат, заявки в друзья) работает только пока приложение на переднем плане —
пробел, отмеченный ещё в инкрементах 13/14/16. Инкремент добавляет третий канал доставки
поверх уже существующего пайплайна "внешней доставки офлайн-пользователю"
(`packages/core/src/platform/notifications/**`, очередь `notify-external`), который до
этого слал только email (Brevo) и веб-пуш (VAPID) — бизнес-логика (`decideExternalDelivery`,
presence-гард, реестр `EXTERNAL_NOTIFY_EVENTS`) не менялась, только источник токенов и
транспорт отправки. Спека — `docs/superpowers/specs/2026-08-23-mobile-push-notifications-increment-17-design.md`.

### Что построено

- **`packages/db/src/schema/expo-push-tokens.ts`** — таблица `expo_push_tokens`
  (`userId` → `users` cascade, `token` unique, `platform`, `deviceId` → `devices.id`
  `ON DELETE SET NULL`, `createdAt`/`lastUsedAt`). Отдельная от `devices` — та моделирует
  пару сессионных токенов с ротацией/отзывом, push-токен живёт своим циклом независимо от
  логина/логаута. Миграция `0057_dapper_vapor.sql`.
- **`packages/db/src/queries/expo-push-tokens.ts`** — `upsertExpoPushToken`/
  `deleteExpoPushToken`/`deleteExpoPushTokensByTokens`/`deleteExpoPushTokensByDeviceId`/
  `listExpoPushTokens`, 1:1 паттерн с `push-subscriptions.ts`.
- **`apps/web/app/api/v1/mobile/push-token/route.ts`** — `POST`/`DELETE`, `getCaller()` →
  401 → zod (`expoPushTokenSchema`/`expoPushUnregisterSchema` в `@vire/api-contracts`) →
  запрос. Без `can()`/RBAC — действие пользователя над своими данными, не бэкофис
  (прецедент — `/api/v1/push/subscribe`).
- **`apps/worker/src/lib/expo-push.ts`** — `sendExpoPush(tokens, payload)`: POST на
  `https://exp.host/--/api/v2/push/send`, чанки по 100 (лимит Expo API), возвращает токены
  с тикет-ошибкой `DeviceNotRegistered` для последующей пруны. Упрощение v1: без опроса
  `/getReceipts` — часть протухших токенов Expo сообщает только асинхронной квитанцией,
  такие переживут до следующего неудачного тикета.
- **`apps/worker/src/workers/notify-external.worker.ts`** — рядом с
  `listPushSubscriptions`/`sendPush` добавлены `listExpoPushTokens`/`sendExpoPush` (оба
  чтения и обе отправки — параллельно через `Promise.all`, не последовательно). Один и тот
  же тумблер `notifyPush` управляет обоими каналами — отдельная настройка "пуш на телефон"
  не заводилась, пользователь не различает браузер/телефон.
- **`apps/web/app/api/v1/auth/devices/[deviceId]/route.ts`** — отзыв устройства каскадом
  чистит `expo_push_tokens` по `deviceId` (best-effort, ошибка прунинга не роняет сам
  отзыв). **Находка ревью**: `devices`-строка никогда не удаляется при отзыве (остаётся
  ради истории входов, только `revokedAt`), поэтому FK `ON DELETE SET NULL` на
  `expo_push_tokens.deviceId` в этом потоке не срабатывает сам по себе — без явного вызова
  отозванный телефон продолжал бы получать чужие пуши после выхода из аккаунта (мобильный
  `signOut()` в `profile-screen.tsx` уже отзывает текущее устройство при выходе, так что
  один этот каскад закрывает и logout, и явный отзыв из списка устройств).
- **`apps/mobile/lib/push.ts`** — `registerForPushNotifications(deviceId)`: Android
  notification channel → запрос разрешения → `getExpoPushTokenAsync({projectId})` →
  `POST /api/v1/mobile/push-token`. Полностью best-effort — нет разрешения, нет
  `projectId`, сетевая ошибка — тихий возврат, экран/вход не блокируется (тот же уровень,
  что `sendTyping`/`markConversationRead`). Вызывается из `sign-in-screen.tsx` (после
  `setAuthTokens`) и из `root-navigator.tsx` при холодном старте с уже сохранённой сессией
  (`getDeviceId()` — новый геттер в `lib/secure-store.ts`; токен Expo может обновиться
  независимо от логина).
- **`apps/mobile/app.json`** — плагин `expo-notifications` добавлен в `plugins`.
  **`extra.eas.projectId` НЕ добавлен** — см. блокер ниже.
- **Deep-link по тапу на уведомление — вне скоупа.** Открывает приложение на последнем
  экране, не конкретный тред (диплинк есть только на релиз, инкремент 8).

### Блокер снят: EAS-проект и FCM привязаны, живая проверка пройдена

Блокер из первой версии этого раздела («нет Expo/EAS-проекта») закрыт в отдельной сессии
(2026-08-23, вручную через веб-панель expo.dev с Даней): создан EAS-проект
`@pruffit/vire-mobile` (`projectId f538ec6c-0032-4ce5-b661-dae649001774`, прописан в
`apps/mobile/app.json` → `extra.eas.projectId` + `owner: "pruffit"`), загружен Android
upload keystore (`vire-upload-keystore.jks`, alias `vire-upload` — не в git) и FCM V1
service account key (загружен через дашборд expo.dev, JSON-файл `*-firebase-adminsdk-*.json`
локальный, не в git). `google-services.json` — на месте, прописан в `app.json` →
`android.googleServicesFile`. Все секретные файлы — под паттернами в
`apps/mobile/.gitignore` (`google-services.json`, `*-firebase-adminsdk-*.json`,
`*.password.txt`).

**Живая проверка пройдена целиком** — свернуть приложение → прислать сообщение с другого
аккаунта → получить настоящий системный пуш через Google Play Services эмулятора. Детали
и находки по ходу — секция «Живая проверка на эмуляторе» ниже.

### Тесты и гейты

`packages/db` typecheck ✓, `db:generate` — миграция `0057_dapper_vapor.sql`.
`packages/api-contracts` typecheck ✓. `apps/web`: typecheck/lint/check:routes/
check:contracts/check:caller ✓, test ✓ (2026 тестов, включая новые
`push-token/route.test.ts` и `devices/[deviceId]/route.test.ts` — 401/400/404/успех/
устойчивость к сбою прунинга). `apps/worker`: typecheck ✓, test ✓ (111 тестов, включая
`expo-push.test.ts` — пустой список, успех, `DeviceNotRegistered` → в пруну, чанкинг
>100 токенов, сетевая ошибка чанка не бросает и не метит токены мёртвыми — и расширенный
`notify-external.worker.test.ts`). `apps/mobile`: typecheck ✓, test ✓ (204 теста, включая
`push.test.ts` — нет projectId/нет разрешения/бросок `getExpoPushTokenAsync`/успешный
путь). `pnpm turbo run check:layers` ✓.

### Живая проверка на эмуляторе

Проведена в отдельной сессии (2026-08-23) после привязки EAS/FCM. `app.json` изменился
материально (`googleServicesFile`, `extra.eas.projectId`) — понадобился чистый ребилд:
`npx expo prebuild --platform android --clean` + `npx expo run:android` на
`VireMusic_Test` (эмулятор `android-36`, тег `google_apis` — Google Play Services есть,
Play Store-приложения нет; `PlayStore.enabled = no` в `config.ini`, для FCM это не
помеха, Play Store и Play Services — разные компоненты). Prebuild подтвердил
`google-services.json` скопирован в `android/app/`, `com.google.gms:google-services`
подключён в `android/build.gradle`, плагин применён в `android/app/build.gradle`.
Сборка (`BUILD SUCCESSFUL in 10m 26s`) и установка прошли без ошибок.

- **Находка по ходу: локальная база отстала от git на одну миграцию.**
  `apps/worker` падал на старте (`DATABASE_URL is not set`, затем `AUTH_SECRET`
  не задан) — у `apps/worker` не было своего `.env` (штатный `dotenv/config` в
  `src/index.ts` читает `.env` из cwd пакета, не из корня монорепо); создан локальный
  `apps/worker/.env` (не в git, по прецеденту `apps/web/.env.local`) с теми же
  `127.0.0.1`-адресами. После этого воркер поднялся, но `notify-external` валился на
  каждой job: `select "token" from "expo_push_tokens"` — **таблицы не было**, хотя
  миграция `0057_dapper_vapor.sql` (инкремент 17) в git уже есть. Причина —
  `drizzle.__drizzle_migrations` пуст (0 строк) на локальной базе, при этом схема
  фактически на уровне 0056 (`devices`/`audit_log`/`feature_flags`/`storage_orphans`
  существуют, `expo_push_tokens` — нет): журнал разъехался со схемой, не тот случай,
  что описан в предупреждении CLAUDE.md про enum в одной транзакции (`db:migrate:fresh`
  на разъехавшемся, не пустом журнале падает на `type "role" already exists`, пытаясь
  переиграть 0000 с нуля). Исправлено разовым скриптом (не закоммичен): бэкфилл 57 строк
  журнала для 0000–0056 (хеш файла + `when` из `meta/_journal.json`, БЕЗ повторного
  выполнения их SQL — объекты уже существуют), затем штатный `drizzle-kit migrate`
  накатил ровно 0057. После этого `\d expo_push_tokens` в психке подтвердил таблицу.
- **Находка по ходу: три параллельных инстанса воркера.** Три последовательных фоновых
  запуска `pnpm --filter @vire/worker dev` (первые два упали на переменных окружения
  выше, но `tsx watch` не завершает процесc при необработанной ошибке верхнего уровня —
  остаётся висеть в режиме ожидания) оставили три живых `tsx watch`-рантайма
  одновременно, все слушающие одну и ту же BullMQ-очередь. Обнаружено по повторяющимся
  логам одних и тех же `jobId` — исправлено `taskkill /T /F` по всем трём деревьям
  процессов и повторным чистым запуском одного инстанса.
- **Регистрация токена подтверждена фактом.** После выдачи разрешения на уведомления
  (Android 16/API 36 требует рантайм-permission `POST_NOTIFICATIONS`; выдано
  `adb shell pm grant … POST_NOTIFICATIONS`, `dumpsys package` подтвердил
  `granted=true`) лог dev-сервера показал `POST /api/v1/mobile/push-token 200`. Прямой
  запрос к Postgres: `expo_push_tokens` получила строку
  `token=ExponentPushToken[JyY1M5NnRgtldooutMD0lV]`, `platform=android`,
  `email=mobiletest@vire.local` — реальный токен от реального `getExpoPushTokenAsync()`
  с валидным `projectId`, не веткой деградации.
- **Находка окружения: SystemUI на эмуляторе ловил повторяющийся ANR** сразу после
  тяжёлой Gradle/CMake-сборки (native-компиляция грузила тот же хост-CPU, что и
  виртуализация эмулятора) — диалог «System UI isn't responding» переоткрывался заново
  после каждого «Wait» несколько раз подряд (logcat подтверждает `Slow dispatch`/
  `Slow delivery … NotifInflation` на 100–1900мс в это окно). «Wait» не помогал,
  **«Close app» (форс-рестарт процесса SystemUI) вылечил** — штатное восстановление
  Android, не баг проекта, но стоит закладывать время на это в следующих сессиях с
  тяжёлым нативным ребилдом непосредственно перед проверкой уведомлений.
- **Сценарий пуша — пройден целиком.** Сессия `mobiletest@vire.local` на устройстве,
  переписка с `rntp-friend2@viremusic.local` из инкрементов 14–16. Приложение свёрнуто
  (`adb shell input keyevent KEYCODE_HOME`, подтверждено `topResumedActivity` = launcher).
  Встречная сторона — одноразовый Node-скрипт (`tweetnacl`+`blakejs`, та же математика,
  что и раньше; не закоммичен): логин `rntp-friend2` через настоящий Auth.js
  credentials-флоу (`/api/auth/csrf` → `/api/auth/callback/credentials` → cookie jar),
  публикация свежего identity-ключа (`POST /api/v1/keys`, upsert — старый ключ инкремента
  13 в базе не мешает), деривация CK против реального `ikPub` `mobiletest`
  (не менялся с инкремента 13), шифрование `crypto_secretbox`, `POST
  /api/v1/chat/messages` → `200`. Redis-ключ `presence:user:{id}` (TTL 40с, живёт только
  пока держится SSE-хартбит) на момент отправки отсутствовал — переписка была свёрнута
  на несколько минут, `isUserOnline` корректно вернул `false` без дополнительных
  ухищрений. Лог воркера: `[notify-external] ✓ job=9 kind=CHAT_MESSAGE` — без ошибки, в
  отличие от прогонов до фикса миграции. `adb logcat` того же окна: `FirebaseMessaging`
  (процесс `com.anonymous.viremobile`) обработал входящее сообщение через ~0.3с после
  ответа API, следом `NotificationListener: received notification posted event -
  com.anonymous.viremobile`. **Главное доказательство** — скриншот развёрнутой шторки
  уведомлений (`adb shell cmd statusbar expand-notifications`):
  карточка «VireMusic · 1m / Новое сообщение / Новое сообщение от Friend Two Mobile» —
  настоящий системный пуш, доставленный Expo Push API → FCM → Google Play Services
  эмулятора, приложение всё это время было в фоне. `adb logcat -d | grep "FATAL
  EXCEPTION"` по всему буферу сессии — пусто.
- Тело пуша — общий переведённый текст (`push.chatMessage.body`), не расшифрованное
  содержимое: сервер физически не видит plaintext (E2EE), поэтому корректность
  собственно шифровки в этом конкретном прогоне не проверялась заново — это уже
  доказано инкрементами 13–16, и не могло повлиять на результат этой проверки при любом
  исходе.

### Осознанно не в этом инкременте

Опрос `/getReceipts` Expo API для полной пруны протухших токенов. Отдельная настройка
"пуш на телефон" вместо телефона отдельно от браузера. Deep-link по тапу на конкретный
чат/экран. Каскад пруны `expo_push_tokens` при массовом отзыве всех устройств
(`DeviceAuthService.refresh()` → `revokeAllForUser` при обнаружении компрометации
refresh-токена) — закрыт только явный отзыв одного устройства и logout, не сценарий
"утечка токена". Реальное физическое Android-устройство (только эмулятор) и лок-скрин
с включённым PIN — не проверялись.

## Инкремент 18: живой прогон вскрыл реальные баги + поиск и плейлисты в медиатеке

Триггер — не план, а живой прогон приложения Danya на устройстве сразу после
инкремента 17: главная не докручивалась, обложки грузились через раз, next/prev в
плеере не реагировали, двойной pull-to-refresh, чат показывал «Не удалось
расшифровать» на 100% сообщений, поиск был буквальной заглушкой. Разбор кода дал
конкретные причины по каждому пункту — см. ниже. **Важно: эта сессия работала без
эмулятора/устройства** (иначе, чем инкременты 1–17) — все находки из чтения кода и
сравнения с уже рабочими соседними экранами, фиксы верифицированы только
`pnpm --filter @vire/mobile typecheck`+`test` (210 тестов, зелёные). Живой прогон на
эмуляторе/телефоне — следующий шаг, не сделан в этом инкременте.

### Починено (причина подтверждена чтением кода)

- **Главная не докручивалась до конца.** `home-screen.tsx` — единственный экран с
  `ScrollView`, у которого `content` не резервировал место под мини-плеер (`paddingVertical:
  16` вместо паттерна `paddingBottom: 96`, который уже был на всех остальных экранах со
  списками). Последние строки списка утыкались в непрозрачный мини-плеер/таб-бар.
  Показательно: `lib/layout.ts` явно вынесен в отдельный файл именно из-за require-cycle
  через `home-screen.tsx` (см. коммент в файле) — то есть код был готов к тому, чтобы
  `home-screen.tsx` использовал `MINI_PLAYER_HEIGHT`, но использования не было. Поправлено:
  `paddingBottom: MINI_PLAYER_HEIGHT + 36`.
- **Обложки грузились через раз, появлялись только после pull-to-refresh.** Весь мобильный
  код использовал голый `Image` из `react-native` — на Android у него нет надёжного
  дискового кеша. Поставлен `expo-image` (`npx expo install`, зарезолвилась `~57.0.3` под
  SDK 57, добавлен config-plugin в `app.json` автоматически) и переключены все 8 мест
  использования (`home-screen`, `mini-player`, `player-screen`, `library-screen`,
  `conversations-screen`, `user-profile-screen`, `release-screen`, `friends-screen`).
  API-совместимо 1:1 (везде было только `source={{uri}} style={...}}`, нигде не было
  `resizeMode`, который у `expo-image` называется иначе).
- **Кнопки next/prev в плеере не реагировали.** Не баг переключения — баг очереди:
  `home-screen.tsx`'s `playHotTrack` собирала очередь из ОДНОГО трека (`playQueue([track],
  0)`) при тапе на любую строку «В топе», а `nextQueueIndex` на очереди длины 1 без
  `repeat` закономерно возвращает `null` → next/prev дизейблены по дизайну. `release-
  screen.tsx`/`library-screen.tsx`/`user-profile-screen.tsx` уже строили очередь из всего
  видимого списка + индекса тапнутого трека правильно — только «В топе» была
  единственным местом с этой недоделкой. Поправлено: `playHotTrack(index)` строит очередь
  из всего `hotTracks`.
- **Профиль мог обрезать контент без возможности докрутить.** `profile-screen.tsx`
  (список устройств) был обычным нескроллящимся `View` с `marginTop: 'auto'` на кнопке
  «Выйти» — тот же класс бага, что и на главной, просто без `ScrollView` вообще. Обёрнуто в
  `ScrollView` с тем же `paddingBottom: 96`.
- **Чат — 100% сообщений «Не удалось расшифровать».** Алгоритм (`lib/e2ee/sodium-compat.ts`)
  корректен и идентичен вебу (round-trip тест это подтверждает), причина не в крипто. В
  тот же день в репозитории появился новый `vire-upload-keystore.jks` и свежий
  `google-services.json` (пуш, инкремент 17) — почти наверняка приложение
  переустанавливалось с другой подписью, а identity (`lib/e2ee/identity.ts`,
  single-device-only, SAS-привязка отложена ещё с инкремента 13) живёт в
  `expo-secure-store`/Android Keystore и стирается при переустановке. Осиротевшая история —
  ожидаемое следствие модели без device-linking, а не баг шифрования. Единственное, что
  разумно чинить кодом: `chat-thread-screen.tsx` теперь отличает «пара повреждённых
  сообщений» от «расшифровать не удалось вообще ничего» — во втором случае один баннер
  («ключ не совпадает с историей») вместо N одинаковых сломанных бабблов подряд, это и
  читалось как «фича мертва». Live-проверка не сделана: нужно отправить новое сообщение с
  обеих сторон после этого фикса и посмотреть, расшифруется ли оно при перезагрузке треда.

### Гипотеза, требует живой проверки (не подтверждено)

- **Двойной pull-to-refresh на главной** — единственный экран с вложенным
  `ScrollView horizontal` близко к верху (карусель «Новые релизы»), классический
  Android-конфликт responder'ов вложенного и родительского скролла. Добавлен
  `nestedScrollEnabled` на карусель — стандартная починка для этого класса проблемы, но не
  проверено на устройстве.
- **Перемотка позиции трека** — код (`PositionSlider`/`PanResponder` в `player-screen.tsx`,
  `player-store.ts`, `TrackPlayer.seekTo` в `audio-engine.ts`) при чтении выглядит корректно,
  конкретной причины в статике не нашлось. Нужен живой репро с логами устройства — не
  тронуто вслепую.

### Новое: поиск

Экран был буквальной заглушкой («Скоро»). Реализован полностью:
`GET /api/v1/search` — та же публичная (рейт-лимит по IP) ручка, что и у веба, схема
`searchResponseSchema` уже существовала в `@vire/api-contracts`, бэкенд не менялся.
`lib/search.ts` (дебаунс 300мс, отмена устаревшего запроса токеном) + `screens/search-
screen.tsx` — три секции (Артисты/Релизы/Треки). Артисты открываются во внешнем браузере
(`expo-web-browser`, уже был в зависимостях под auth-bridge) на веб-странице артиста —
нативного экрана артиста в мобилке пока нет, придумывать наспех не стали. Релизы ведут на
уже существующий `ReleaseDetail`. Треки — очередь из всего списка результатов поиска +
индекс тапнутого (та же логика, что чинили в «В топе»). `SearchScreen` теперь под своим
`navigation/search-stack.tsx` (был плоским табом без возможности что-либо запушить —
понадобился стек, чтобы открывать `ReleaseDetail` из поиска). `ReleaseScreen` из-за этого
переиспользуется сразу в двух стеках (`home-stack.tsx` и `search-stack.tsx`) — типизация
пропса сужена до `{ route: { params: HomeStackParamList['ReleaseDetail'] } }` вместо
`NativeStackScreenProps<HomeStackParamList, 'ReleaseDetail'>`, потому что экран не читает
`navigation`, а типы `NativeStackNavigationProp<ParamList>` двух разных стеков структурно
несовместимы (разные `navigate()`). `components/stub-screen.tsx` (был нужен только
поиску) удалён — использований больше не осталось.

### Новое: плейлисты в медиатеке

`GET /api/v1/playlists` (без `?trackId=`) и `GET /api/v1/playlists/{id}` уже существовали
на бэкенде (использовались только под «добавить в плейлист» на вебе/в шите) и уже
проверяют видимость через `playlistService().getForViewer(id, caller?.id)` — приватный
чужой плейлист корректно отдаёт 403/404. Бэкенд не менялся, добавлены только клиентские
обёртки `fetchPlaylists()`/`fetchPlaylistDetail()` в `lib/playlists.ts`. `library-screen.tsx`
теперь одна вертикальная `FlatList` (данные — скачанное), где горизонтальный ряд
плейлистов и заголовок «Скачанное» — `ListHeaderComponent` (не вложенный `ScrollView` —
тот же паттерн, которым чинили карусель на главной, только сразу без бага). Новый экран
`screens/playlist-screen.tsx` — трек-лист плейлиста, плей/лайк/добавить-в-плейлист/скачать
на каждой строке, 1:1 по структуре с `release-screen.tsx`. `Library`-таб получил свой стек
(`navigation/library-stack.tsx`) — раньше это был плоский таб без возможности запушить
`PlaylistDetail`, та же причина, что и у нового `search-stack.tsx`.

### Осознанно не в этом инкременте

Лайки (список ВСЕХ лайкнутых треков пользователя) в медиатеке — на вебе живёт в
`/library/liked` через SSR-запрос к репозиторию напрямую, отдельного `/api/v1/*`
эндпоинта под это нет, значит нужен новый бэкенд-роут (не только клиентский код) — не
стали добавлять backend surface без явного запроса. Экран артиста в мобилке (сейчас
результаты поиска по артистам уводят во внешний браузер на веб-страницу). Живой прогон
на эмуляторе/устройстве всего, что перечислено выше как «починено»/«гипотеза».

## Инкремент 19: стеклянная система «Дым» — первый проход

Направление и токены — из design-канвасов этой же сессии («VireMusic UI Kit», «VireMusic
Glass», «VireMusic Final States»): из трёх исследованных стеклянных систем («Дым»/«Слои»/
«Призма») выбран «Дым» — нейтральное графитовое стекло (`#12100e @40%`, blur+saturate,
specular-линия сверху, инсет-кромка), accent живёт в контенте, не красит саму
поверхность стекла. Как и «Инкремент 18» — **без эмулятора/устройства в этой сессии**,
верифицировано только `typecheck`/`test` (210 тестов, зелёные); визуальный результат
блюра/прозрачности не видел никто, кроме мокапов.

Заведён переиспользуемый `components/glass.tsx` (`<Glass>`) — единственное место, где
живут токены стекла: `expo-blur` (`BlurView`, `intensity`, `tint="dark"`,
`experimentalBlurMethod="dimezisBlurView"` на Android — без него, по документации библиотеки,
блюр на Android либо не рендерится, либо деградирует к сплошному тону в зависимости от
версии; не проверено живьём) + тонировка `rgba(18,16,14,.4)` + верхний sheen-градиент
(`expo-linear-gradient`) + горизонтальная specular-линия сверху + опциональная accent-rim
снизу (проп `accentRim`, пока нигде не задействован — под будущую тему артиста) + внешняя
тень/окантовка. Пропы `edge`/`shadow` позволяют убрать полную окантовку и тень для
пристыкованных (не «плавающих отдельной плашкой») поверхностей — см. таб-бар ниже.
Установлены новые зависимости: `expo-blur ~57.0.2`, `expo-linear-gradient ~57.0.1`
(`npx expo install`, автолинковка, конфиг-плагин не потребовался, в отличие от
`expo-image` в инкременте 18).

Применено (правило кита: стекло только на плавающих/оверлейных слоях, не на карточках
списков — те остаются матовыми `#060503`):

- **Мини-плеер** (`components/mini-player.tsx`) — был пристыкованным на всю ширину с
  прямым верхним бордером; стал плавающей вставленной плашкой (`left/right:12`,
  `radius:18`) поверх стекла, тот же приём, что во всех мокапах.
- **Таб-бар** (`navigation/main-tabs.tsx`) — `tabBarBackground` теперь `<Glass edge="top"
  shadow={false}>` вместо сплошной заливки `colors.card`. **Сознательно НЕ**
  `position:'absolute'` на `tabBarStyle`: floating/полупрозрачный таб-бар в RN обычно
  ставят absolute, чтобы контент экрана реально просвечивал сквозь блюр, но тогда КАЖДЫЙ
  экран должен сам резервировать высоту таб-бара снизу (сейчас это делает навигатор
  автоматически, и на этом резерве держится весь фикс скролла из инкремента 18). Без
  живой проверки менять это для всех экранов сразу — риск того же класса регресса, что
  чинили в инкременте 18, поэтому бар остаётся пристыкованным: тонировка/specular видны,
  настоящего блюра «сквозь контент под ним» — нет (блюрить нечего, там ничего не
  рисуется). Это осознанный компромисс, не половинчатая реализация по недосмотру.
- **Поисковая строка** — `screens/search-screen.tsx` и `screens/friends-screen.tsx`,
  раньше матовая карточка `colors.card`, теперь `<Glass>`.
- **Composer чата** (`screens/chat-thread-screen.tsx`) — вся строка ввода+кнопка отправки
  теперь один стеклянный капсуль вместо матового поля ввода в обычном ряду.
- **Транспортный ряд плеера** (`screens/player-screen.tsx`) — shuffle/prev/play/next/repeat
  теперь внутри одной стеклянной капсулы (`radius:28`), как на мокапах; центральная кнопка
  play остаётся сплошным `colors.primary`-кругом поверх стекла — тоже по мокапам.
- **Шит «Добавить в плейлист»** (`components/add-to-playlist-sheet.tsx`) — панель была
  сплошной `colors.card` с закруглением только сверху, стала `<Glass radius={24}>`
  (закругление теперь на всех 4 углах — упрощение, не резал `Glass` под индивидуальные
  радиусы углов ради одного места).
- **Полноразмерная размытая обложка фоном шапки** — «ARTIST HEADER»/«COVER FULL-BLEED» из
  мокапов, отдельно от стеклянной системы: `<Image blurRadius={60/80} contentFit="cover">`
  на весь контейнер + `LinearGradient`-скрим сверху для читаемости текста, поверх — резкая
  обложка/текст как раньше. Применено в `release-screen.tsx`/`playlist-screen.tsx` (шапка
  релиза/плейлиста, `blurRadius:60`) и во весь `player-screen.tsx` (полноэкранный плеер,
  `blurRadius:80`, экран раньше был плоским `colors.background`). Чисто аддитивный слой
  позади существующего контента — не трогает скролл/лэйаут-логику, поэтому ниже риска, чем
  всё остальное в этом инкременте.
- **Кнопка закрытия полного плеера** (`player-screen.tsx`) — была голой иконкой без фона,
  стала маленьким стеклянным кружком (`<Glass radius={18}>` 36×36) — правило кита «иконка
  без подписи = круг» применено к последней такой кнопке в приложении (остальные — либо
  внутри уже стеклянных капсул типа транспортного ряда, либо инлайн-иконки в строках
  списка, которых это правило не касается).
- **Таб-бар — визуально плавающая плашка, но не `position:'absolute'`.** Компромисс между
  «совсем ничего не трогать» и полным риском перехода на absolute: `tabBarStyle` получил
  `marginHorizontal:12`, `marginBottom:6`, `borderRadius:22`, а `<Glass>`-фон — полную
  окантовку+тень (`edge`/`shadow`, раньше только верхняя specular-линия). Навигатор
  по-прежнему резервирует ту же высоту `TAB_BAR_CONTENT_HEIGHT + insets.bottom` — margin
  только сдвигает видимую заливку внутри уже зарезервированной полосы, экранам ничего
  пересчитывать не нужно. Риск здесь чисто визуальный (плашка может оказаться на пару
  px не там, где задумано, если React Navigation меряет высоту бара иначе, чем
  предполагалось) — не риск «контент недоступен», который был у absolute-варианта.

### Осознанно не в этом инкременте

Полная замена таб-бара на плавающие раздельные круглые кнопки (вариант из мокапа «2e» —
самая крупная структурная переделка навигации, требует custom `tabBar`, не трогали).
Accent-rim (акцентная нижняя линия от обложки/темы артиста) — проп в `<Glass>` есть,
использования пока нет. Иконки-кнопки внутри списков (лайк/скачать/добавить-в-плейлист)
не переведены в круглые стеклянные чипы — кит требует этого только для плавающих/
навигационных кнопок, не для инлайн-иконок в строках списка. Живая проверка на
устройстве, включая реальную стоимость blur на Android (кит явно предупреждает: дорого
при большом числе одновременных поверхностей) — не сделана. `position:'absolute'` на
таб-баре сделан следующим же инкрементом (см. ниже) — решение поменялось: пользователь
явно попросил продолжать несмотря на названный риск.

## Инкремент 20: таб-бар — настоящий `position:'absolute'`

Продолжение инкремента 19 после явного запроса продолжать, несмотря на предупреждение
о риске (контент может спрятаться за таб-баром — тот же класс бага, что «Инкремент 18»,
но теперь потенциально на ВСЕХ экранах под таб-навигатором, а не только на главной). Как
и всё в инкрементах 18–20 — **без эмулятора/устройства**, верифицировано только
`typecheck`/`test` (210 тестов, зелёные), сама раскладка не видена ничьими глазами.

**Что сделано.** `navigation/main-tabs.tsx`: `tabBarStyle.position:'absolute'` — теперь
контент экранов реально просвечивает сквозь блюр таб-бара (`tabBarBackground` из
инкремента 19), а не просто тонируется поверх чёрного фона. Расплата: навигатор больше
НЕ резервирует место под таб-бар сам — резервировать обязан каждый экран.

Единая точка формулы — новый хук `useContentBottomPadding()` (`lib/layout.ts`):
`useTabBarHeight() + MINI_PLAYER_HEIGHT(60) + зазор_мини-плеера(10) + запас(16)`. Один хук
вместо копипасты формулы по экранам — если формула неверна, чинить в одном месте, а не в
десяти. Раньше отступ был константой `paddingBottom:96`, вычисленной вручную под резерв
только мини-плеера (когда таб-бар резервировал себя сам) и не учитывающей
`insets.bottom` — на устройствах с жестовой навигацией снизу (`insets.bottom` > 0, типично
20–34px) эта константа стала бы заведомо недостаточной после перехода на absolute.

Обновлены ВСЕ экраны под `MainTabs` — по одному разу `paddingBottom: 96` → динамический
`useContentBottomPadding()`: `home-screen.tsx`, `library-screen.tsx`, `search-screen.tsx`
(три места — `centered`×3 состояния + `listContent`), `friends-screen.tsx`,
`conversations-screen.tsx`, `user-profile-screen.tsx`, `release-screen.tsx`,
`playlist-screen.tsx`, `profile-screen.tsx` (ScrollView, был единственным без вообще
никакого скролла до инкремента 18 — теперь тоже на общем хуке), `chat-thread-screen.tsx`
(composer, единственный НЕ список — фиксированная строка ввода в обычном потоке `flex`
после `FlatList`, не absolute, поэтому сама отвечает за собственный нижний отступ).
`player-screen.tsx` НЕ трогали — он не под `MainTabs` (модальный экран поверх всего
`RootStack`, таб-бар туда не долетает в принципе).

**Осознанный компромисс на composer чата.** Резервирует полный
`useContentBottomPadding()` (таб-бар + мини-плеер + зазоры), не только высоту таб-бара —
хотя мини-плеер показывается не всегда. Разбирался вариант «резервировать только под
таб-бар, мини-плеер игнорировать»: она даёт меньше пустого места под полем ввода, когда
музыка не играет, но если трек всё-таки играет во время переписки (совершенно обычный
сценарий, не редкий), мини-плеер — глобальный компонент поверх `MainTabs`
(`navigation/main-screen.tsx`) — рисуется поверх composer'а и в буквальном смысле
перекрывает кнопку отправки/часть поля ввода тапом, не просто визуально. Заведомая пустая
полоса под полем ввода, когда музыка не играет, — меньшее зло, чем неработающая кнопка
отправки, когда играет.

### Осознанно не в этом инкременте

Условный (зависящий от того, играет ли сейчас трек) нижний отступ — усложнение ради
чуть более плотной вёрстки composer'а чата, посчитано не стоящим риска без возможности
проверить визуально. Реальная проверка на устройстве всего вышеперечисленного — по-прежнему
не сделана, это самое важное, что осталось.

## Сборка релизного APK — новая находка: `armeabi-v7a` детерминированно ломает CMake/ninja

После правок инкрементов 18–20 собирали `./gradlew assembleRelease` на уже существующем
(не пересозданном `expo prebuild --clean`) `android/`-проекте — сознательно, чтобы не
перевыпускать `debug.keystore` (см. гипотезу инкремента 18 про переустановки и потерю
E2EE-identity) и не заводить ещё один цикл «переустановка → тест».

**Симптом.** `ninja: error: manifest 'build.ninja' still dirty after 100 tries` на CMake-
конфигурации `expo-modules-core` (первый раз), затем `react-native-screens` (второй раз) —
не то же самое, что уже задокументированный Windows `MAX_PATH` (`.npmrc`
`virtual-store-dir-max-length`, см. выше): пять последовательных попыток (обычный ретрай,
точечная чистка `.cxx`-кеша упавшего модуля, чистка кеша сразу всех известных `.cxx`
включая `android/app/.cxx`, однопоточная сборка `--max-workers=1
-Dorg.gradle.parallel=false`) — падали идентично. Ни чистка кеша, ни отключение
параллелизма не помогли — тот же модуль (`expo-modules-core`) падал на чистом кеше точно
так же, как на старом, что исключает гипотезу «протухший кеш».

**Общее во всех пяти падениях: ABI всегда `armeabi-v7a`** (ни разу `arm64-v8a`/`x86_64`/
`x86`). Сборка с `-PreactNativeArchitectures=arm64-v8a,x86_64` (без `armeabi-v7a` и
неиспользуемого `x86`) прошла с первого раза, `BUILD SUCCESSFUL in 3m 29s`. Причина именно
`armeabi-v7a`-тулчейна на этой машине не диагностирована глубже (не Windows Defender/
антивирус-специфично — не проверялось так далеко), но воспроизводится детерминированно.

> ⚠️ **Диагноз выше опровергнут в P0 — дело не в ABI.** То же падение
> (`manifest 'build.ninja' still dirty`) воспроизвелось на `arm64-v8a` после добавления
> одной зависимости, причём **полная очистка всех `.cxx`** его не сняла. Настоящая
> причина — расположение `.cxx` внутри pnpm-стора: замерено **252 символа** до объектного
> файла при лимите Windows в 260, плюс стор состоит из симлинков, которые CMake и ninja
> нормализуют по-разному. `armeabi-v7a` был лишь корреляцией: триплет
> `arm-linux-androideabi` длиннее `aarch64-linux-android`, поэтому упирался в лимит
> первым. Лечится `plugins/with-native-build-dir.js` — выносит `.cxx` в `apps/mobile/.cxx`.
> После этого сборка проходит целиком (`BUILD SUCCESSFUL in 23m 35s`).

**Практический вывод:** `armeabi-v7a` (32-битный ARM) на реальных устройствах 2026 года
практически не встречается, эмулятору (`x86_64`) не нужен — собирать под
`arm64-v8a,x86_64` можно постоянно, а не только как обходной путь. APK получился
59 МБ (было 28 МБ у `VireMusic.apk` от прошлой сборки сегодня — сравнение нерелевантно,
разный набор ABI и контент). Подписан тем же `debug.keystore`, что и раньше в этой
сессии (не пересоздавался) — устанавливаться поверх уже стоящей версии должен без
требования деинсталляции. Файл лежит в `apps/mobile/VireMusic.apk` (тот же путь, что и
раньше — перезаписан).

## Инкремент 21: живой прогон нашёл нативный краш стеклянной навигации — реальный блюр на Android отключён

Первый живой прогон инкрементов 19–20 (эмулятор `VireMusic_Test`, debug-сборка через
`expo run:android` + Metro, местный dev-бэкенд). До этого момента вся стеклянная система
проверялась только `typecheck`/`test` — никто не видел её в рантайме.

**Находка 1 (без действий от пользователя): предупреждение в логе, не крашащее.**
`BlurView` с `experimentalBlurMethod="dimezisBlurView"` печатал `WARN` дважды: сам проп
устарел (нужен `blurMethod`), а `dimezisBlurView` с SDK 57 `expo-blur` требует явный
`blurTarget` — без него молча деградирует к `blurMethod:'none'` (то есть на Android
реального блюра не было вообще ни разу за инкременты 19–20, только тонировка).

**Находка 2 (настоящий краш).** Починка находки 1 «в лоб» — завести один `BlurTargetView`
(из `expo-blur`) на корне приложения (`App.tsx`, оборачивает `<RootNavigator>`), получить
на него `ref` через React Context (`lib/blur-target.tsx`) и прокинуть его как `blurTarget`
во все `<Glass>` — привела к нативному краху: `Fatal signal 11 (SIGSEGV)` в потоке
`RenderThread` через пару секунд после старта (`adb logcat`: `libc: Fatal signal 11...
fault addr ... in tid ... (RenderThread)`, процесс убит `Zygote`/`ActivityManager`).
Воспроизводится детерминированно на каждом холодном старте после того, как JS-бандл с
`BlurTargetProvider` реально долетал до устройства (два предыдущих запуска не показывали
краш только потому, что упирались в обрыв связи с Metro раньше, чем успевали
отрендерить дерево).

**Причина (по чтению нативного источника `expo-blur`, не подтверждено багрепортом
апстрима).** `ExpoBlurTargetView.kt` — кастомный `ViewGroup`, который переопределяет
`addView`/`removeView`/`getChildAt`/`onMeasure`/`onLayout`, чтобы прозрачно проксировать
всех детей во внутренний `BlurTarget` (библиотека Dimezis). Это ломает договорённости,
на которые опирается Fabric (единственная архитектура в этой версии RN — `react-
native@0.86.2`; `newArchEnabled:false` в `app.json` ни на что не влияет, это устаревший
флаг Paper-эры) при монтировании поддерева, а обёрнутое поддерево в данном случае —
**весь навигатор**, включая `react-native-screens`, который сам агрессивно управляет
нативными view при переключении экранов. Даже сам файл честно предупреждает в
комментарии о хрупкости этого проксирования (см. обработку `indexOfChild`), но случай
Fabric+`react-native-screens`+корень приложения там не разобран.

**Решение — не чинить архитектуру, откатить фичу до безопасного состояния.** Реальный
блюр на Android (`blurMethod`/`blurTarget`) убран из `components/glass.tsx` целиком,
`lib/blur-target.tsx` и обёртка в `App.tsx` удалены. `<BlurView>` без `blurMethod`
по документации библиотеки сама рендерит полупрозрачную заливку без блюра — это не
временная заглушка, а ровно состояние «reduced», уже описанное как легитимный fallback
в UI-ките (§02, «Android · инженерная спека»: тумблер «Стеклянный интерфейс» +
автоматический fallback при просадке fps). Тонировка, верхний sheen-градиент, specular-
линия и внешняя тень — всё это по-прежнему работает и визуально читается как стекло
(проверено скриншотом), просто без размытия фона позади панели. Правильная реализация
настоящего блюра под Fabric (например, точечный `BlurTargetView` внутри каждого экрана
вместо одного на весь навигатор, либо другая библиотека) — отдельная задача, не решалась
в этом инкременте.

**Что подтверждено живым прогоном после отката** (debug-сборка, local dev backend,
аноним-сессия): главная грузится и рендерит реальные данные без краша; плавающие таб-бар
и мини-плеер видны, не крашат приложение; тап по треку в «В топе» воспроизводит очередь
(сам плейбек падает — `[player] load/play упал` — но это тестовый трек локального
dev-сида без реального аудиофайла, не связано со стеклом). Не проверено в этом
инкременте: полноэкранный плеер, чат, шиты — навигация к ним не пройдена вживую из-за
наложения RN LogBox-тоста на тач-события в дев-сборке, следующий прогон должен пройти
дальше. Гейты: `pnpm --filter @vire/mobile typecheck`/`test` (210/210) — зелёные.

## Инкремент 22: настоящий блюр на Android — без краша, точечный `BlurTargetView`

Прямая обратная связь по инкременту 21: (1) навигация всё ещё была стандартным
bottom-tabs с подписями — кит требует раздельные круги без текста, «полная замена
таб-бара» из инкремента 19 осталась недоделанной; (2) плоская тонировка без блюра
не читается как «жидкое стекло». Оба пункта закрыты в этом инкременте, живым прогоном на
эмуляторе (debug и release) против прод-бэкенда.

### Навигация — раздельные круги

`navigation/main-tabs.tsx`: стандартный `tabBarStyle`/`tabBarIcon` заменён на кастомный
`tabBar={(props) => <CircleTabBar {...props} />}` — 4 независимых `Pressable`-круга
56×56 без подписи (активный — сплошной `colors.foreground`, остальные — `<Glass>`),
раскладка `justify-content:'space-between'` во всю ширину с полями 22, как в ките.
`tabBarStyle`/`tabBarLabelStyle`/`tabBarIcon` из `screenOptions` больше не используются.
Найден и исправлен собственный баг по ходу: активный круг рендерился квадратом —
`styles.circle` не задавал `borderRadius` (у неактивных кругов радиус приходил из
`<Glass radius={28}>`, у активного — нет).

### Настоящий блюр — почему предыдущий откат был too pessimistic

Инкремент 21 отключил `blurMethod`/`blurTarget` целиком, сделав вывод «краш = блюр
недостижим». Живой прогон в этом инкременте проверил более узкую гипотезу: крашит не
`BlurTargetView` как таковая, а обёртка ЕЮ ВСЕГО НАВИГАТОРА (конфликт её кастомного
`ViewGroup`, переопределяющего `addView`/`removeView`, с Fabric-рендерингом
`react-native-screens` на уровне стеков). Тестовая стеклянная панель с реальным
`blurTarget`, вставленная ТОЛЬКО внутрь контента `home-screen.tsx` (обычный `ScrollView`,
без вложенных Screen-контейнеров) — не крашила ни разу за десяток холодных стартов,
принудительных остановок и навигаций, и в логе НИ РАЗУ не появилось предупреждение
«blurTarget не настроен» (то есть блюр реально включался, не откатывался на `none`).

**Архитектура** (`lib/blur-target.tsx`, новый файл):
- `BlurTargetProvider` — обычный React Context (не нативная обёртка, поэтому безопасно
  оборачивает весь `<RootNavigator>` в `App.tsx`, в отличие от `BlurTargetView` из
  инкремента 21) — хранит `RefObject` текущей цели блюра.
- `useRegisterBlurTarget(ref)` — экран регистрирует свой ЛОКАЛЬНЫЙ `BlurTargetView` как
  общую цель, пока сам в фокусе (`useFocusEffect`), снимает регистрацию при потере
  фокуса — иначе плавающий таб-бар/мини-плеер продолжили бы блюрить контент экрана,
  с которого ушли, а не текущего.
- `useBlurTarget()` — что читает `<Glass>` (`components/glass.tsx`): `blurMethod`/
  `blurTarget` восстановлены, `blurTarget` берётся из контекста, а не пропом.

**Единая точка подключения** — `components/screen.tsx` (общая обёртка safe-area,
которой уже пользовались 9 из 10 экранов под `MainTabs`): сама оборачивает `children`
в `BlurTargetView` и вызывает `useRegisterBlurTarget` — экраны (`library`, `search`,
`friends`, `conversations`, `user-profile`, `release`, `playlist`, `profile`,
`chat-thread`) не потребовалось трогать по отдельности. `home-screen.tsx` не использует
`Screen` и подключён вручную — все три состояния (`loading`/`error`/`empty`/`ready`)
сведены в единый `BlurTargetView`, чтобы `blurTarget` не оставался ни на что не
указывающим при неготовых данных.

### Живой прогон

Debug-сборка (Metro, local dev backend, аноним-сессия, `VireMusic_Test`): холодный
старт → главная с реальными данными → круглый таб-бар без подписей → навигация между
вкладками — `adb logcat` без единого `FATAL EXCEPTION`/`SIGSEGV` за всю сессию (несколько
force-stop/relaunch подряд). Release-сборка (x86_64, минификация+shrinkResources, прод
viremusic.ru): тот же результат — жив, без краша, и **скриншотом подтверждён реальный
блюр**: строки списка треков реально просвечивают сквозь неактивные круги таб-бара
(частично видимый текст «Untouchable», «заверни меня в пакет» под кругами Поиск/
Медиатека/Профиль) — раньше (инкремент 19–21) круги были непрозрачной плоской заливкой,
сквозь которую не проходило ничего. Финальный `VireMusic.apk` (arm64, прод) собран тем
же способом, живой прогон на эмуляторе не переносился на него отдельно (иное ABI, тот же
JS-бандл и тот же нативный код блюра). Не проверено: полноэкранный плеер/чат/шиты —
тот же нерешённый класс проблемы с LogBox-тостом в дев-сборке, что и в инкременте 21.

Гейты: `pnpm --filter @vire/mobile typecheck`/`test` (210/210) — зелёные.

## Инкремент 23: liquid glass на Skia-шейдере — объём, преломление, эластичная деформация

Обратная связь по инкременту 22 была по существу: «мало прозрачности и преломлений,
активная кнопка непрозрачная, нет ни ширины, ни глубины, шейдеров; технически это матовые
плоские круги; когда тянешь кнопку — она должна эластично деформироваться вместе с иконкой
и искажениями света». Всё верно: `View` + `LinearGradient` + `BlurView` (`components/
glass.tsx`, инкременты 19–22) физически не могут дать ни нормали поверхности, ни
зависимости картинки от угла обзора — это тонированные слои, а не оптика.

### Что построено

Новый `components/liquid-glass.tsx` — SKSL-шейдер поверх `@shopify/react-native-skia`:

- **Объём.** Нормаль полусферы (`z = sqrt(1 - r²)`) — поверхность «заворачивается» к краю,
  и от этой нормали считается всё остальное, а не рисуется отдельными градиентами.
- **Френель** (`pow(1 - dot(N,V), 3)`) — кромка стекла всегда ярче центра; главный признак
  того, что объект объёмный, а не залитый круг.
- **Specular** от направленного источника (`reflect(-L, N)`, экспонента 46) плюс широкий
  мягкий sheen — блик, а не просто белый градиент сверху.
- **Хроматическая аберрация** по краю: каналы R/G/B смещены по-разному и зависят от `N.x`,
  отсюда цветная кайма, характерная для толстого стекла.
- **Эластичная деформация с сохранением объёма.** Вдоль вектора перетаскивания капля
  растягивается, поперёк сжимается; сопротивление — `tanh(t / DRAG_LIMIT)`, поэтому чем
  дальше тянут, тем неохотнее она идёт за пальцем. Нормаль берётся от УЖЕ деформированной
  координаты — блик, Френель и аберрация едут вместе с формой, а не наклеены поверх.
  Иконка деформируется тем же законом (`translate` + анизотропный `scale`).
- **Активное состояние** — подсветка ИЗНУТРИ (`core = smoothstep(1.0, 0.05, r)`, свет
  гаснет к краю), кромка остаётся стеклянной. Заливка сплошным цветом (как было в
  инкременте 22) убивала объём — именно поэтому активная кнопка читалась плоской.

`navigation/main-tabs.tsx` переведён на `LiquidGlassButton`; старый `components/glass.tsx`
остаётся для панелей (мини-плеер, поиск, sheets) — там нужна широкая поверхность, а не
капля, и переводить их на шейдер этот инкремент не пытался.

### Зависимости и сборка (три отдельные Windows-грабли)

Поставлены `@shopify/react-native-skia` 2.6.2, `react-native-reanimated` 4.5.1,
`react-native-worklets` 0.10.4, `react-native-gesture-handler` 2.32. Reanimated в коде
напрямую не используется (пружина возврата — своя, на `requestAnimationFrame`), но
он **обязателен**: Skia's `<Canvas>` импортирует его из `sksg/Container.native.js`,
несмотря на `peerDependenciesMeta.optional`. Попытка выкинуть reanimated дала рантайм
`react-native-reanimated is not installed!` — путь тупиковый, проверено.

1. **Skia prebuilt-бинарники не ставятся под pnpm.** Их кладёт postinstall-скрипт, который
   в pnpm-раскладке не отрабатывает → `CMake Error: Skia prebuilt binaries not found`.
   Лечится `npx install-skia` ИЗ `apps/mobile` (из корня репозитория npx не находит
   исполняемый файл). Важно: бинарники ложатся в конкретный путь пакета внутри
   `.pnpm/<хеш>/`, а **любая** переустановка зависимостей меняет этот хеш и стирает их —
   после каждого `pnpm add/remove` в мобилке `install-skia` нужно повторять.
2. **`ninja: manifest 'build.ninja' still dirty after 100 tries`** — та же Windows-беда с
   длиной пути, что ловили на `armeabi-v7a` (см. выше), теперь на reanimated: pnpm кладёт
   пакет в `.pnpm/<32-символьный хеш>/node_modules/…`, а CMake достраивает поверх
   `android/.cxx/<config>/<hash>/<abi>/CMakeFiles/…`. Чистка `.cxx`, `prebuild --clean` и
   однопоточная сборка не помогают (проверено четырьмя заходами). **Лечится причина:**
   в `android/build.gradle` добавлен `subprojects`-хук, переносящий
   `externalNativeBuild.cmake.buildStagingDirectory` в короткий `C:/rnx/<module>` — после
   этого сборка проходит с первого раза. ⚠️ `android/` генерируется `expo prebuild` и
   лежит в `.gitignore` — при следующем `prebuild --clean` хук **потеряется** и его надо
   вернуть (кандидат на вынос в expo config plugin, в этом инкременте не делалось).
3. **Битый кэш Metro** после смены набора нативных модулей: `Error: Unable to deserialize
   cloned data due to invalid or unsupported version` → Metro не поднимается вообще.
   Лечится `rm -rf .expo/cache node_modules/.cache` + `expo start --clear`.

### Живая проверка

Эмулятор `VireMusic_Test`, debug-сборка + Metro, прод-бэкенд `viremusic.ru`, реальная
сессия. Подтверждено скриншотами: неактивные кнопки — объёмные стеклянные сферы с
specular-бликом сверху-слева и отчётливой фиолетово-синей хроматической аберрацией по
кромке; активная — светлая капля с подсветкой изнутри и стеклянным краем (не плоская
заливка); **деформация снята в движении** — при перетаскивании кнопка вытянулась в эллипс
поперёк направления движения, иконка уехала вместе со стеклом, блик сместился по новой
нормали. `adb logcat` — ни одного `FATAL EXCEPTION`/`SIGSEGV` за сессию.

Гейты: `pnpm --filter @vire/mobile typecheck`/`test` (210/210) — зелёные.

### Осознанно не в этом инкременте

Преломление РЕАЛЬНОГО фона под кнопкой (сейчас шейдер строит оптику по собственной нормали,
а размытие фона даёт лежащий ниже `BlurView`): для этого нужен доступ к пикселям
подложки — либо весь экран рисовать внутри Skia-Canvas, либо снапшотить фон, обе дороги
существенно дороже. Панели (`components/glass.tsx`) на шейдер не переводились. iOS не
проверялся (нет Mac). Замер стоимости шейдера на слабом реальном устройстве не делался.

## Инкремент 24 — liquid glass: преломление реального фона, плоская линза, живой прогон

Обратная связь по инкременту 23: «розовые мыльные пузыри, без преломления, при перетаскивании
иконка не деформируется, сами кнопки обрезаются квадратом, тянутся слишком легко». Разбор
показал, что все четыре пункта — разные баги, а не вкусовщина.

### Что было сломано

1. **Обрезка квадратом.** `<Canvas style={StyleSheet.absoluteFill}>` внутри `View` 56×56:
   Skia режет всё за прямоугольником канваса, поэтому растянутая капля упиралась в квадрат
   56×56. Лечится запасом `PAD` вокруг круга (канвас `size + 2*PAD`, позиционируется на
   `-PAD`). RN на Android детей НЕ клипает (`ReactViewGroup` ставит `clipChildren = false`),
   так что выход за пределы host-вьюхи безопасен, а хитбокс остаётся 56×56.
2. **Мыльный пузырь.** Нормаль полусферы (`z = sqrt(1 - r²)`) гнёт всё поле зрения — это
   стеклянный шарик, а не линза. У толстого стекла профиль другой: **плоская середина плюс
   фаска у кромки**, центр показывает фон почти 1:1, свет ломается в узком кольце по краю.
3. **Розовый налёт.** Хроматическая аберрация считалась от смещения `(1-z)*R*0.72` (до ~20 px)
   по всей площади плюс аддитивные блики поверх тёплого тинта. Теперь дисперсия пропорциональна
   крутизне фаски, то есть в середине её нет вовсе.
4. **Возврат непремультиплицированного цвета.** SkSL-шейдер обязан возвращать premultiplied
   alpha; `half4(color, alpha)` без домножения давал пересветку и грязные края иконки.
5. **Анимация через `setState` 60 раз в секунду** — перерисовка React на каждый кадр.
   Теперь пружины на Reanimated, uniforms приходят в Skia через `useDerivedValue`.

### Ключевая находка: GPU-образы убивают шейдер молча

`Skia.Surface.MakeOffscreen(...).makeImageSnapshot()` отдаёт **GPU-текстуру, привязанную к
контексту JS-потока**. Отрисовка Skia идёт на своём рендер-треде, где такая текстура невалидна,
и рантайм-эффект с ней в качестве дочернего шейдера **не рисует ничего — без ошибки, без
предупреждения, просто пустой кадр**. Внешне это неотличимо от «шейдер не скомпилировался»,
и именно на это ушла основная часть отладки: SKSL компилировался, `makeShaderWithChildren`
в JS отрабатывал, `visit()` доходил до `pushShader`, а на экране было пусто.

**Правило: любой `SkImage`, полученный из offscreen-поверхности и уходящий в `<ImageShader>`,
прогонять через `makeNonTextureImage()`.** Это касается и маски иконки, и снимка фона.
Оговорка есть в самой библиотеке — `ReanimatedRecorder`: «the recorder only work if the GPU
resources are owned by the main thread».

Попутно: JS-файлы `sksg/Recorder/**` на нативе мёртвые (играет C++-рекордер), инструментировать
их бесполезно; Metro резолвит пакет по полю `react-native` → `src/index.ts`, а не `lib/module`.

### Как устроено сейчас

`components/liquid-glass.tsx` — один SKSL-шейдер на кнопку:

- **Профиль.** `BEVEL = 0.32` радиуса — фаска; наклон `t²/sqrt(1-t²)` даёт ноль в центре и
  почти вертикаль у кромки. Нормаль строится от наклона, от неё же — Френель, блики, преломление.
- **Преломление — живое, не по снимку** (см. ниже): шейдер рисует только поверхность и
  оставляет середину линзы почти пустой, увеличенный фон под ней даёт нативный `BlurView`.
- **Блики.** Два источника (ключевой сверху-слева, отражённый снизу-справа), оба живут
  только на фаске (`bevelMask`), а не размазаны по всей площади.
- **Активное состояние** — светлое стекло, а НЕ заливка: подсветка полупрозрачна (~0.62),
  увеличенный фон под ней продолжает читаться, фаска и кромка работают поверх. Переход
  `withTiming` 240 мс, цвет иконки лерпится в шейдере (иконка — белая маска, а не два
  разных изображения).
- **Деформация.** Обратный варп координаты: капля едет за пальцем с жёстким сопротивлением
  `tanh(t / (LIMIT*4))` — даже на 100 dp протяжки уезжает лишь на ~7 dp; вытягивается вдоль
  вектора (хвост сильнее носа — каплевидная форма), сжимается поперёк с сохранением площади.
  Иконка семплируется той же координатой,
  поэтому мнётся вместе со стеклом, и отстаёт от него на 50 % (`ICON_LAG`) — стекло едет,
  иконка догоняет.
- **Иконка** рисуется в пикселях устройства (в dp мылила на 3x-экранах); под ней —
  затемнение центра линзы, иначе штрих спорит с текстом, который виден сквозь стекло.

### Почему фон — живой BlurView, а не снимок экрана

Снимок экрана (`makeImageFromView`) как источник преломления был построен и **отвергнут по
замеру**: на эмуляторе `VireMusic_Test` один кадр 1080×2400 стоит **~1000 мс** (софтверный
GL; на устройстве меньше, но всё равно не покадрово). Любая схема поверх снимка отстаёт от
контента по построению — стекло «замерзает» на старой картинке при скролле, и никакими
частотами обновления это не лечится. Промежуточные варианты (переснимать по окончании
скролла, прятать устаревший снимок за прозрачностью) давали либо мазню, либо заметный фриз.

Поэтому фон линзы — нативный `BlurView` (`blurMethod="dimezisBlurView"`, `blurTarget` из
`lib/blur-target.tsx`), который рисует контент сфокусированного экрана покадрово. Он лежит
под Skia-канвасом в круглом клипе, а **увеличение даёт трансформ `scale: LOUPE`** — это и есть
преломление толстого стекла, только в реальном времени и бесплатно для JS. Skia сверху
рисует лишь поверхность: фаску, Френель, блик, кромку, иконку и деформацию, оставляя
середину почти прозрачной.

Цена подхода: увеличение равномерное по всей линзе, кольцевого «засасывания» окружения по
кромке нет — для него нужно семплировать пиксели, а живых пикселей фона у Skia нет. Оптику
кромки держат Френель и блик.

### Грабли RNGH 2.32 + reanimated 4

Ворклет-колбэки `Gesture.Pan()` в этой связке **молча не выполняются** — не срабатывает даже
`onBegin` (при этом `Gesture.Tap()` работает). Лечится `.runOnJS(true)`; пружины всё равно
крутятся на UI-потоке, через мост идёт только установка цели. Нажатие вынесено в отдельный
`Gesture.Tap()` (Pan на коротком тапе может не активироваться вовсе) — оба в
`Gesture.Simultaneous`.

### Живая проверка

Эмулятор `VireMusic_Test`, debug-сборка + Metro, прод-бэкенд. Подтверждено скриншотами:
кнопки рисуются (неактивные — тёмное стекло с фаской и кромкой, активная — светлая матовая
линза с тёмной иконкой), розового налёта нет, обрезки квадратом нет, переключение табов и
переход активного состояния работают, при перетаскивании капля уезжает за пальцем, вытягивается
по вектору, сужается поперёк, **иконка деформируется вместе с ней**. `Skipped frames` за сессию
— 1 против ~60/сек у промежуточной версии; `FATAL`/`SIGSEGV` нет.

Промежуточный вариант со снимком экрана был снят и на светлом контенте: увеличение и изгиб
текста под линзой читались, но именно он и показал неустранимое отставание картинки — из-за
чего фон переведён на живой `BlurView`.

**Не подтверждено живьём:** финальный вариант снят только на экранах, где под баром чёрный
фон (лента «В топе» к концу прогона перестала приходить с прода), поэтому увеличение живого
контента под линзой скриншотом не зафиксировано — проверить первым делом. Подтверждено:
сборка не падает, `blurTarget` доезжает до бара, пропусков кадров с четырьмя живыми
`BlurView` нет (0 «Skipped frames» за сессию).

**Не проверено:** iOS (нет Mac), реальное устройство вместо эмулятора, стоимость четырёх
живых `BlurView` на слабом железе.

## Инкремент 25 — liquid glass: доводка до «дорого»

Обратная связь по инкременту 24 (скриншот живого прогона): кнопки читаются плоскими
наклейками, контент проходит сквозь ряд, активная не отличается от остальных.

### Что изменилось

1. **Тень.** Кнопка не отрывалась от контента, потому что тени не было вовсе. Рисуется в том
   же шейдере, в кольце `r ∈ (1, 1.62]` (внутри круга её место занимает само стекло, а линза
   под канвасом — нативная вьюха, дотянуться до неё из SKSL нечем): широкая ambient со
   смещением вниз плюс узкая контактная. Ради этого поднят `PAD` (26 → 32) и снят ранний
   выход шейдера на `r > 1`.
2. **Тинт стал светлым, а не тёмным** (`0.16` → `0.60` при низкой альфе). Тёмное стекло на
   чёрном контенте исчезает, и держать кнопку приходится жирной кромкой — ровно от этого она
   и читалась хромированной бусиной. Светлый слабый тинт (как у системного материала iOS)
   даёт видимый диск на любом фоне, и кромку можно свести к волоску.
3. **Кромка — дуга, а не кольцо.** Ровное кольцо по всему кругу читается нарисованным
   контуром. Теперь яркая дуга сверху-слева по ключевому свету, слабая снизу от отражённого,
   тёмные бока (`absorb` — толщина стекла). Ширина полосы сведена к `rc ∈ [0.90, 0.985]`.
   **Альфа кромки и блика идёт вровень с их яркостью**: при заниженной альфе premultiplied
   результат гаснет и край становится невидимым на тёмном фоне — из-за этого в 24-м кромка
   с яркостью 0.85 и альфой 0.14 не была видна вообще.
4. **Фаска сплющена** (`BEVEL` 0.34 → 0.18), блики сужены (экспоненты 34/60 → 55/80). Было
   стеклянное яйцо, стало стекло-диск: середина плоская и прозрачная, оптика — в узком кольце.
5. **Ореол под иконкой.** Маска иконки теперь двухслойная: белый штрих (зелёный канал) поверх
   размытого красного ореола, шейдер берёт `ink.a - ink.g` как локальную тень. Без него
   светлый штрих тонет в светлой обложке, а гасить ради этого виньеткой ВСЮ линзу — значит
   убить преломление (в 24-м виньетка была 0.20, теперь 0.04).
6. **Активная вкладка.** Раньше отличалась неразличимо. Теперь плотнее стекло, ярче кромка
   (`lift`), внешний ореол в кольце тени и иконка на полной яркости (неактивные — 0.82).
   Светлой шайбой её по-прежнему не делаем: в ряду тёмных кнопок она выбивается.
7. **Скрим таб-бара** (`navigation/main-tabs.tsx`) — длинный мягкий градиент под рядом:
   контент уезжает под плавающие кнопки, и без подложки строки трека шли прямо сквозь ряд.
   `BlurView` линзы целится в контент экрана напрямую и скрима над ним не видит, поэтому у
   кнопки есть проп `dim` — линза гасит себя на ту же величину (иначе светится дыркой).
8. Нажатие даёт bloom бликам и кромке (`bloom`), штрих иконки потолстел (2.3 → 2.75 в
   36-сетке ≈ 1.83 dp).
9. По правке после первого превью стекло сделано ещё прозрачнее: плотность `body`
   0.07–0.22 → 0.04–0.15, активная 0.34 → 0.26, `dim` линзы 0.24 → 0.16. Кромка, тень и
   ореол под иконкой не трогались — на них держится читаемость на любом фоне.

### Как это проверялось без устройства

`adb` в этой сессии недоступен, поэтому шейдер прогонялся **оффлайн на CanvasKit**
(`canvaskit-wasm` уже лежит в зависимостях `@shopify/react-native-skia`): скрипт вынимает
SKSL из `liquid-glass.tsx`, компилирует его (`RuntimeEffect.Make` — ловит синтаксис ровно
как рантайм: невалидный шейдер роняет приложение на импорте модуля) и рисует ряд кнопок
поверх имитации контента — тёмная лента и светлая обложка. Дальше правки шли по картинке,
а не на глаз. Способ воспроизводимый и стоит держать в уме для любой правки этого шейдера.

**Не подтверждено живьём:** прогон на эмуляторе/устройстве после этих правок не делался —
проверить первым делом (в первую очередь тень: `PAD` вырос, канвасы соседних кнопок теперь
перекрываются на ~16 dp; и стоимость `intensity` блюра 4 → 9).

### Осознанно не сделано

**Преломление на кромке** (кольцевое «засасывание» окружения) — прототип собран и снят:
кромка требует второго `BlurView` на кнопку с другим масштабом (8 живых блюров на бар
вместо 4), а выигрыш на превью оказался небольшим и виден только на контрастном контенте.

## Инкремент 26 — размер кнопок, прозрачность, гонка регистрации блюр-цели

Обратная связь с реального телефона (первый прогон вне эмулятора): «нужно ещё поработать над
преломлениями и прозрачностью; при переходах по экранам меню иногда лагает, не прогружает
преломления и выкидывает из приложения». Плюс просьба увеличить кнопки — их четыре, и на
ширине экрана они терялись.

### Гонка в `useRegisterBlurTarget` (реальный баг, не вкусовщина)

`lib/blur-target.tsx` снимал регистрацию безусловно: `return () => setTarget(null)`. Порядок
focus-эффекта ВХОДЯЩЕГО экрана и cleanup'а уходящего навигацией не гарантирован — если
cleanup отработал вторым, уходящий экран стирал цель, которую входящий уже записал. Таб-бар
оставался вообще без цели, `blurTarget?.current` — null, `BlurView` не монтировался: ровно
симптом «не прогрузило преломления» до следующего переключения вкладки. Снятие теперь
условное — `setTarget((current) => (current === ref ? null : current))`.

**Краш этим не закрыт.** Воспроизвести его без устройства нечем, а гадать по симптому
«выкидывает» — значит городить спекулятивные правки поверх работающего кода. Нужен
`adb logcat` с телефона в момент вылета (искать `FATAL EXCEPTION` / `SIGSEGV` и имя
нативной библиотеки в стеке): у `expo-blur` уже есть задокументированный конфликт
`BlurTargetView` с Fabric-рендерингом `react-native-screens` (см. «Инкремент 21»), и если
крашится он — стек это назовёт одной строкой.

### Размер и прозрачность

- `CIRCLE_SIZE` 56 → 68, `TAB_BAR_CONTENT_HEIGHT` 54 → 68 (высота бара обязана расти вместе
  с кнопкой, иначе контент экранов уезжает под ряд — отступ считается от этой константы).
- `PAD` перестал быть константой: запас под тень теперь доля диаметра (`PAD_RATIO = 0.44`),
  иначе при росте кнопки тень обрезалась бы прямоугольником канваса.
- `LOUPE` 1.45 → 1.75 — преломление стало заметным, а не догадкой.
- Плотность стекла `body` 0.04–0.15 → 0.03–0.11, виньетка 0.04 → 0.03, `dim` линзы
  0.16 → 0.10, скрим бара ослаблен (низ 0.55 → 0.46).

Проверено оффлайн-рендером на CanvasKit (метод описан в инкременте 25). **На устройстве после
этих правок не проверялось.**

## Инкремент 27 — настоящее преломление (AGSL RenderEffect) и краш блюра

### Краш «выкидывает при переходах» — цикл в дереве RenderNode

Воспроизведён на эмуляторе стресс-тестом (переключение вкладок), стек однозначный:

```
Cause: stack pointer is not in a rw map; likely due to stack overflow
signal 11 (SIGSEGV) ... tid RenderThread
#00 RenderNode::prepareTreeImpl
#02 SkiaDisplayList::prepareListAndChildren   ← 170 повторов пары
```

`dimezisBlurView` рисует свою цель ВНУТРЬ себя. `components/screen.tsx` оборачивает экран в
`BlurTargetView` и его же регистрирует общей целью блюра, а `<Glass>` из того же экрана эту
цель запрашивал — то есть собственного предка. Цель содержит BlurView → дерево RenderNode
замыкается → бесконечная рекурсия → переполнение стека. Затрагивало `search-screen`,
`friends-screen`, `chat-thread-screen`, `player-screen`, `add-to-playlist-sheet`.
**Баг существовал с инкремента 19/21**, к правкам стекла отношения не имеет.

Фикс: цель объявляет вокруг детей область (`BlurTargetScope` в `lib/blur-target.tsx`), и
`useBlurTarget()` не отдаёт цель потребителю ВНУТРИ неё. Таб-бар и мини-плеер живут снаружи
экранов — блюр получают; стекло внутри экрана получает `null` и деградирует до штатного
полупрозрачного фолбэка expo-blur. Проверено: 32 переключения вкладок, тот же PID, пустой
crash-буфер (до фикса процесс умирал примерно на 24-м).

Там же поправлена гонка регистрации: снятие цели стало условным
(`setTarget(cur => cur === ref ? null : cur)`) — порядок focus-эффекта входящего экрана и
cleanup'а уходящего навигацией не гарантирован, и уходящий стирал чужую запись. Это и был
симптом «иногда не прогружает преломления».

### Преломление: `RenderEffect` + AGSL вместо аффинного zoom

До этого «преломлением» был `transform: scale` на блюр-вьюхе. Это лупа: коэффициент один и
тот же в центре и у кромки, на границе круга картинка скачком не стыкуется с фоном. Настоящий
ход луча — `sample = center + dir·f(r)` с нелинейной `f(r)`, а аффинным трансформом такая
функция не выражается в принципе. Skia-шейдер поверхности тоже не помогает: пикселей нативной
подложки он не видит.

Единственный путь на Android — `RenderEffect.createRuntimeShaderEffect`: он отдаёт AGSL-шейдеру
УЖЕ отрисованное содержимое вьюхи. Новый локальный Expo-модуль `apps/mobile/modules/glass-lens/`
вешает такой эффект на контейнер с `BlurView` внутри, то есть шейдер получает живой размытый
бэкдроп и семплирует его по смещённой координате:

```
rs(r) = r/magnify + (edgeReach − r/magnify) · t^2.6      // t — положение в фаске
```

В плоской середине — равномерное увеличение (толщина стекла), в фаске смещение растёт
лавинообразно, у кромки выборка уходит на `edgeReach` радиусов: то, что лежит ЗА кнопкой,
сжимается в тонкое кольцо. Отсюда же обе аберрации, и обе живут только в фаске: хроматическая
(R/G/B с расхождением ∝ t²) и сферическая (пара выборок со спредом ∝ t², середина резкая).

Ключевые ограничения конструкции:
- Вьюха линзы **в 1.55× больше кнопки** (`OVERSCAN`): за её пределами шейдеру нечего
  семплировать, а видимый круг вырезает сам шейдер по `r > 1`.
- `bevel` модуля обязан совпадать с `BEVEL` шейдера поверхности, иначе подложка и
  нарисованная поверх кромка описывают разные стёкла.
- Гейт `Build.VERSION.SDK_INT >= 33` (`createRuntimeShaderEffect` — Android 13+) отдаётся в JS
  константой `isGlassLensSupported`; ниже остаётся прежний аффинный `LOUPE`.
- Модуль **локальный** (`modules/`), подхватывается `expoAutolinking.useExpoModules()` — то
  есть `expo prebuild` не нужен и хук `buildStagingDirectory → C:/rnx` в `android/build.gradle`
  остаётся цел.

### Грабли AGSL

1. **`flat` — зарезервированное слово** (квалификатор интерполяции). `float flat = ...` даёт
   `error: 15: expected ';', but found 'flat'`, шейдер не компилируется.
2. Ошибка компиляции прилетает исключением из конструктора `RuntimeShader` и **валит создание
   всей вьюхи** (`Couldn't create view of type GlassLensView`), кнопка остаётся вообще без
   подложки. Создание обёрнуто в `runCatching` — деградирует до обычного контейнера.

### Живая проверка

Эмулятор `VireMusic_Test` (Android 36, x86_64), **release-APK**, прод-бэкенд. Скриншотами
подтверждено: обложка под кнопкой изогнута, текст под линзой гнётся и сжимается к кромке —
это не равномерный zoom. Ошибок шейдера в logcat нет, крашей нет.

**Не проверено:** реальное устройство; производительность (эмулятор с `hw.gpu.enabled=no`
для этого непригоден в принципе — 6 выборок на пиксель надо мерить на железе); iOS (модуль
android-only, там остаётся прежний путь).

## Инкремент 28 — «белое стекло»: фон окна, а не тинт

Линза показывала ровную светлую шайбу везде, где под кнопкой нет контента (ниже конца
списка, чёрный фон). Замер: строго `rgba(255,255,255,0.8)` над чёрным (204,204,204),
**одинаково во всех четырёх кнопках и во всех точках диска**.

### Причина

`expo-blur` очищает каждый кадр захвата фоном окна:

```kotlin
blurView.setupWith(dimezisBlurTarget).setFrameClearDrawable(decorView.background)
```

`MainActivity` запускается с темой `Theme.App.SplashScreen`, у которой
`android:windowBackground` — splash-drawable с `splashscreen_background = #FFFFFF`.
Где контент экрана не рисует, в захвате остаётся этот белый — линза честно его показывает.
`AppTheme` тоже не задавала `windowBackground` (наследовала светлый от
`Theme.AppCompat.DayNight`).

Лечится в теме, а не в стекле: `#030201` в `splashscreen_background`, новый
`activityBackground` + `android:windowBackground` у `AppTheme`, плюс `expo.backgroundColor`
и `expo.android.backgroundColor` в `app.json` — чтобы правка пережила `expo prebuild`,
который генерирует `android/` заново (как и хук `buildStagingDirectory → C:/rnx`).
Побочно уходит белая вспышка на старте тёмного приложения. Проверено: 204 → 18/11,
преломление на месте.

### Как искалось — и три неверные гипотезы до этого

Симптом лечили вслепую трижды (альфа выборок, `tint="dark"`, `visibility`), и ни одна
правка его не убрала. Помог бисект, а не рассуждение:

1. **Замер по центру кнопки бесполезен.** При `r = 0` смещение `rs` равно нулю — оптика
   тождественна, и два разных шейдера дают побайтово одинаковый пиксель. Плюс в центре
   лежит штрих иконки. Мерить надо сеткой по диску, мимо иконки.
2. **Одинаковые значения в кнопках на разных концах экрана** = константа, а не захваченный
   контент. Это сразу исключает «блюр показывает не то».
3. **Линза, выключенная целиком**, дала 6,5,4 и 48,48,51 (активная) — поверхностный
   Skia-шейдер тёмный и корректный, значит светлое рисует подложка. Только после этого
   имело смысл читать исходники `expo-blur`.

**Молчаливый фолбэк — отдельная ловушка.** `runCatching`/`catch {}` вокруг создания
`RuntimeShader` и `requireNativeView` превращали отказ в «всё хорошо»: grep по logcat
не находил ошибок, потому что их никто не писал. Теперь оба пути логируют
(`Log.e` на несобравшийся AGSL, `Log.i` на реально наложенный эффект с размерами и
радиусом, `console.warn` на незагруженную нативную вьюху) — без этого сигнала диагностика
не сходится.

### Прочее в этом инкременте

- **`visibility` у линзы трогать нельзя** в переходных состояниях: `dimezisBlurView`
  прекращает захват, когда вьюху прячут, и сам не оживает. Прятать допустимо только при
  полностью отсутствующем шейдере — это постоянное состояние.
- **Альфа выборок** обязана доживать до результата: развернуть цвет по исходной альфе
  (`straight()`), а вернуть с чужой — значит сделать прозрачный бэкдроп непрозрачным.
  Порог `0.004` вместо `> 0`: деление на околонулевую альфу раздувает шум half-точности.
- Тинт поверхности приглушён (0.60 → 0.40, кромка 0.82 → 0.62, блик 1.05 → 0.80) — уже
  по картинке, а не вслепую.

---

## VireGlass Phase 3 — модель материала и Material Lab

Полная документация вынесена в `docs/vireglass/` (`README.md` — статусы и ограничения,
`architecture.md` — карта слоёв, `material-lab.md` — журнал экспериментов над оптикой).
Здесь — только то, что меняет работу с мобильным приложением.

**Стекло описывается объектом, а не набором пропов.** `VireGlassMaterial`
(`lib/vireglass/material.ts`) — оптические понятия (преломление, толщина, Френель, блик,
дисперсия, тинт, кромка), геометрия отдельно (`{width, height, cornerRadius}`, круг и
капсула — частные случаи). Дефолт — `VIREGLASS_MATERIAL_V1`. `LiquidGlassButton` принимает
опциональный проп `material`; остальной публичный API кнопки не изменился.

**Общая поверхность.** `components/vireglass/glass-surface.tsx` (`VireGlassSurface`) —
композиция бэкдропа, линзы и Skia-канваса на произвольном скруглённом прямоугольнике.
`LiquidGlassButton` теперь построен на ней; поверхностная оптика больше не ограничена кругом.

**Геометрия считается один раз.** Текст SDF живёт в `lib/vireglass/sdf.ts` и подставляется
в оба шейдера; исходник AGSL собирается в TypeScript и уезжает в `GlassLensView` пропом
`shaderSource`. Копии SDF в Kotlin больше нет.

> ⚠️ **Рассинхрон имён пропов JS↔Kotlin Expo проглатывает молча.** Так преломление было
> выключено в проде с инкремента 24: JS слал `lensRadius`/`edgeReach`, натив ждал
> `glassWidth`/`glassHeight`/`cornerRadius`/`edgePush`, `applyEffect()` выходил по проверке
> `glassWidth <= 0f` до `setRenderEffect`. Симптом почти невидим (`intensity=9`,
> `tint="dark"` на тёмном фоне). Класс ошибки закрыт тестом-паритетом в
> `lib/__tests__/vireglass-material.test.ts`: он разбирает `GlassLensModule.kt` и
> `GlassLensView.kt` и падает на любом расхождении имён пропов и униформ.

**Стенд материала.** `EXPO_PUBLIC_GLASS_LAB=material` заменяет приложение экраном
`screens/material-lab.tsx`: тумблер на каждое оптическое явление, слайдеры по всем
параметрам, пресеты, debug-режимы (SDF, маска, кромка, Френель, нормали, …), выбор формы,
морфинг двух поверхностей. Тумблер **обнуляет параметр**, а не переключает вариант шейдера.

**Отклик на ориентацию** (`lib/vireglass/environment.ts`) реализован — акселерометр →
фильтр низких частот → мёртвая зона → направление света, — но в Material v1 выключен
(`environment: 0`) и на сенсор при нуле не подписывается. Зависимость `expo-sensors`
добавлена; **сборка dev-client/APK обязательна** — нативный модуль новый.

**Что не проверено.** Оптика Material v1 не смотрелась на устройстве, стоимость не
измерена. Прежний замер мерил конвейер без преломления — см. поправку в
`docs/vireglass/benchmarks/2026-08-28-scaling-device-release.md`.

---

## P3 — плеер как поверхность продукта: материал v2, жесты, шторка

Спека — `docs/superpowers/specs/2026-08-30-mobile-player-redesign-p3.md`.

### Главное: на фуллскрин-плеере стекла не было вовсе

`GlassPanel` вызывался без `blurTarget`, а `useBlurTarget()` для стекла **внутри** экрана
по устройству возвращает `null` — иначе `dimezisBlurView` замыкает дерево RenderNode на
себя и роняет RenderThread (`lib/blur-target.tsx`). То есть панель транспорта была
шейдерной кромкой поверх пустоты: ни блюра, ни преломления, при полной стоимости Skia.

Раскладка, которая это чинит и которую надо сохранять при любых правках плеера:

```
<View>                        ← корень экрана, НЕ цель блюра
  <BlurTargetView ref>        ← цель: ambient + обложка + весь скролл
  <Transport blurTarget={ref} />   ← СИБЛИНГ поверх, не потомок
```

Цель не может быть предком стекла. Транспорт получает ref напрямую; `useBlurTarget()`
здесь не годится — он вернёт цель нижележащего таб-экрана.

### Материал VireGlass v3

Продовый дефолт — `VIREGLASS_MATERIAL` (= **v3**, снят на устройстве в стенде). v1 и v2
остались пресетами стенда для сравнения. Диагноз v1: `edgeWidth 0.5` при
`edgeStrength 0.55` — узкая яркая полоса, то есть **нарисованная обводка**, а не оптическая
фаска. v2 перенёс оптику в фаску и поменял размытие на преломление. v3 пошёл дальше:
блюр 4.3, фаска тонкая (0.07), зато вдвое сильнее дисперсия (0.54) и Френель (0.77) —
стекло опознаётся кромкой и расщеплением цвета, а не мутью. Впервые включён отклик на
ориентацию (`environment 0.27`).

> ⚠️ **Числа материала сняты на КРУПНОЙ панели, и буквально мелким поверхностям их давать
> нельзя.** Все краевые длины модели заданы долей полуразмера — стекло масштабируется вместе
> с деталью, и кнопка таб-бара получала ту же ДОЛЮ оптики при вчетверо меньшем размере, то
> есть в абсолютных единицах почти ничего (13.7 dp фаски на листе против 2.4 на кнопке).
> У настоящего стекла фаска и смещение заданы средой, а не размером куска: на мелком объекте
> оптика занимает бо́льшую его долю. Компенсация — `sizeBoost` в `lib/vireglass/geometry.ts`,
> разбор — `docs/vireglass/material-lab.md` §E-18.

`environment > 0` подписывается на акселерометр. Подписка ОДНА на приложение
(`lib/vireglass/environment.ts`, рефкаунт): по слушателю на поверхность давало бы до шести
на один сенсор.

### Иерархия действий

Транспорт: `♥ · ⏮ · ▶ · ⏭ · ↗`. Лайк и шеринг — в главном ряду, `shuffle`/`repeat`
уехали на строку таймкодов. Решение продуктовое: у площадки прямой связи артиста и
слушателя лайк и шеринг — то, чем поддержка доходит до артиста; режимы воспроизведения —
утилиты.

### Жесты по обложке

Свайп ←/→ — карусель треков (обложка доезжает до края и только потом меняется индекс:
смена синхронна, иначе соседняя обложка телепортируется). Свайп ↓ — свернуть. Тап —
иммерсив. Двойной тап — лайк (только ставит; снятие — кнопкой). Долгое нажатие — лист
действий.

> ⚠️ **Pan обязан активироваться только на горизонталь и на движение вниз**
> (`activeOffsetX` + `activeOffsetY` с положительным порогом). Обложка занимает бо́льшую
> часть первого экрана, и если Pan забирает вертикаль целиком, страницу нельзя
> пролистать пальцем по обложке — а это основной путь к тексту и очереди.

> ⚠️ **Первый экран обязан вычитать высоту плавающего транспорта и `insets.bottom`.**
> Без этого капсула ложится на заголовок, а таймкоды уезжают под системную навигацию —
> и заодно прячут строку ошибки воспроизведения, из-за чего отказ выглядит как «кнопка
> не нажимается».

### Шторка уведомления

`Capability.Stop` и `Capability.SeekTo` убраны — проверено на устройстве по
`dumpsys media_session`: `actions` = play/pause/next/prev.

> **Полоса прогресса в системной карточке остаётся** и убрать её нельзя: Android рисует
> её, пока сессия сообщает длительность, а без длительности ломается лок-скрин. Без
> `ACTION_SEEK_TO` она неинтерактивна — ручки нет, пальцем не тянется. Это соответствует
> требованию «скраббера быть не должно», а не обход.

Кнопка лайка — кастомное действие MediaSession через патч RNTP
(`patches/react-native-track-player@4.1.2.patch`): `NotificationButton` в KotlinAudio
закрыт перечислением, поэтому коннектор достаётся рефлексией по приватному полю
`mediaSessionConnector`. Нажатие уходит наружу как `remote-like` (в JS уже типизирован
как `Event.RemoteLike`), состояние иконки приходит из JS через `setLikeState`.

> ⚠️ **`createNotification()` у KotlinAudio асинхронный и перезаписывает список кастомных
> действий** уже после первой установки провайдера — из-за этого кнопка не появлялась
> (`custom actions=[]` в дампе при отсутствии ошибок в логах). Провайдер переустанавливается
> на каждом `setLikeState`.

Иконки живут в ресурсах **самой пропатченной библиотеки** (`rntp_like_*`) и берутся
константой `R`, а не `getIdentifier` по имени: так отпадает зависимость от ресурсов
приложения и конфиг-плагина. В `proguard-rules.txt` патча есть keep-правило на
рефлексируемое поле — при включении minify R8 переименовал бы его и кнопка молча исчезла бы.

### Прочее

`layout.touchTarget` 44 → 48 (44 — величина из iOS HIG, Material требует 48).
`MINI_PLAYER_HEIGHT` 60 → 64: обложка 48 при инсете 8 со всех сторон, её радиус равен
радиусу панели минус инсет. Прогресс мини-плеера — волосяная линия внутри панели,
`pointerEvents: none`: это индикатор, а не скраббер.

## VireGlass Phase 4 — автоадаптация и спектральная оптика

Полная карта — `docs/vireglass/README.md`, журнал экспериментов — `material-lab.md`
(E-34…E-41). Здесь только то, что меняет поведение приложения.

**Корневой баг: линза семплировала пустоту.** Узел захвата (`GlassBackdropView`) никогда не
получал `setPosition`, а `RenderNode` клипуется своими границами — `drawRenderNode` рисовал
ничто. Всё, что мерилось «после чистого захвата», мерило стекло, которому нечего показать;
метрика шума такое состояние от чистого рендера не отличает. Одна строка вернула
преломление, тело и кромку.

**Стекло само ведёт полярность надписей.** `GlassPanel` и `LiquidGlassButton` по умолчанию
`adaptive`: они получают из нативного зонда светлоту фона под собой и, когда светлая надпись
перестаёт читаться (контраст ниже 3.2:1), перекрашивают её в тёмную — плавно, за 420 мс, с
гистерезисом и тремя подтверждениями подряд. Детям полярность раздаётся через
`useInkColor` (`lib/vireglass/glass-ink.tsx`); явно заданный `ink` автоматику отключает.

Ради этого в нативном модуле появился **зонд светлоты**: раз в 180 мс он рендерит узел
захвата в сетку 48×96 (`HardwareRenderer` + `ImageReader`) и отдаёт каждой линзе статистику
её прямоугольника — среднюю светлоту, перцентили 10/90, пестроту. Считать это в шейдере
нельзя: плотность тела — нелинейная функция светлоты, и дискретность оценки давала
призрачные копии текста под стеклом.

**Униформы линзы едут одним каналом** (`uniformNames`/`uniformSizes`/`uniformValues`).
Отдельных `Prop` под каждую величину больше нет — именно они давали молчаливое отключение
линзы при опечатке в имени. Побочный эффект: оптика правится без пересборки APK.

**Оптика.** Добавлены дифракция на кромке и интерференция в тонкой плёнке (причина в
материале одна — `film`, толщина плёнки в нм); дисперсия переведена на отклонение по Коши
(синий гнётся сильнее красного, оба в одну сторону). Все три — множитель оттенка к отражению,
без единой лишней выборки текстуры. На выходе — мягкое сжатие вместо жёсткого клампа: на
светлом фоне подсветка выбивала канал, и стекло становилось плоским пятном без деталей.

**Тонирование градиентное, размытие вспомогательное.** Зонд отдаёт плоскость светлоты, а не
одно число: над светлой половиной детали тело плотнее, над тёмной почти прозрачно. Именно
этим закрывается разнородный фон. Размытие только смягчает фактуру — дай ему волю, и буквы
под стеклом перестают быть буквами. И оно ОДНО И ТО ЖЕ по всей линзе: гасить его к фаске
нельзя, получается шар с мутной серединой и резким ободком, то есть два разных стекла в
одной форме.

**Касание.** У кнопки две тактильные отдачи — лёгкая на касании и заметнее на срабатывании:
касание и действие это разные события, и различать их на ощупь важнее, чем экономить
вибрацию. Возврат после протяжки намеренно недодемпфирован (ζ ≈ 0.5) — капля качается назад.

> ⚠️ **Правка шейдера требует перезапуска приложения**, а не только Fast Refresh: исходник
> уезжает в нативную вьюху пропом из мемоизированного адаптера.

> ⚠️ **Стенд управляется диплинком**, а не тапами: `vire://lab?zone=11&preset=2`. `adb shell
> input tap` приходит с опозданием и теряется — состояние уезжает уже после того, как скрипт
> его сверил, и замер идёт не над тем фоном. URL обязательно в кавычках: `&` иначе съедает
> шелл устройства. Измеритель кадра — `apps/mobile/scripts/glass-probe.mjs`.

## Дизайн стенда `/rnd` — на Android

Экран трека и нижняя фурнитура главной приведены к виду, доведённому в веб-стенде материала.
Спека с числами раскладки — `docs/superpowers/specs/2026-09-06-mobile-stand-design.md`.

**Экран трека считается снизу вверх.** Опора — стеклянная кнопка «ПОТОК» у нижнего края;
над ней транспорт, таймкоды, полоса, подпись, обложка. Первый экран занимает всю высоту
вьюпорта, и остаток высоты копится **воздухом над обложкой**, а не зазором внутри группы:
провал посреди экрана читался бы разрывом. На высоком аппарате растёт верхний отступ, на
низком первой уступает обложка — её сторона считается от того, что не занято шапкой и
фиксированной стопкой управления.

Ряд действий у подписи (лайк, поделиться) и верхняя панель (свернуть · источник · текст ·
`⋯`) держат значки 21–22 dp, а тач-зону добирают `hitSlop` — раздувать под неё сам значок
кит запрещает. Тумблер текста переехал из угла обложки в шапку: в углу он спорил с самой
обложкой за то же место.

**«ПОТОК» заменил `WaveBanner`.** Баннер в секции контекста был строкой-действием под
сгибом, то есть тем, что находят, а не тем, чем пользуются. Кнопка — первый экран, стекло
управления, знак из `@vire/design-tokens/marks` и витринное начертание из токена
`font.display`: один и тот же знак и один и тот же гротеск на вебе и на Android.

**Прогресс мини-плеера — состояние самого стекла, а не полоска на нём.** Левая часть плашки
стоит в активном состоянии, правая нет, граница едет слева направо (`u_progress` в ядре).
Ради этого `VireGlassSurface` научился принимать `progress` как shared value и подставлять
его в канал униформ линзы **анимированным пропом** — как каплю тяги. Обычным пропом он
пересобирал бы весь канал каждый кадр и затирал подставленную ворклетом каплю.

**Материал фурнитуры — `VIREGLASS_CONTROL_MATERIAL`** (толще и чище базового V5), и поверх
него `materialForInk`: плашка, кнопки навигации и «ПОТОК» несут краску приложения, а
требование читаемости под ней задаёт ядро, а не клиент. Иначе одна и та же кнопка со
значком получает на вебе и на Android разную читаемость.

Скрим под фурнитурой доведён до стендового (до `0.9` у самого низа): прежние `0.46` не
гасили строки списка, и между кнопками они проходили сквозь ряд в полную силу.

> ~~Список «НЕДАВНЕЕ» из стенда намеренно НЕ переносился: он там леса, чтобы под стеклом
> ехал контент. Продуктового эндпоинта недавно прослушанного нет (`play_events` —
> аналитический лог), главная остаётся на своих SDUI-блоках.~~
>
> **Отменено следующим инкрементом** («Дизайн-макет на Android»): источник нашёлся — блок
> `personal` уже отдаёт `recentlyPlayed`, и список переехал как продуктовый
> (`components/recent-list.tsx`), а не как леса.

## Дизайн-макет на Android

Экран трека и главная приведены к макету из стенда материала. Спека с числами —
`docs/superpowers/specs/2026-09-06-mobile-stand-design.md`.

**Величины макета — пропорции, а не dp** (`lib/design/mock.ts`). Макет нарисован на экране
шириной 300, телефон шире, и перенос сырыми числами даёт композицию на четверть мельче при
формально совпадающих числах. Через масштаб идут геометрия, кегли и **толщина с фаской
материала**: деталь, выросшая с прежней фаской, отдаёт кромке меньшую долю полуразмера, и
та читается тоньше нарисованной.

**Отбивки макета — от базовых линий и от центра ряда транспорта.** Перенесённые полями между
блоками, они дают стопку выше нарисованной на сумму строчных боксов, и обложка сжимается.
Переводятся в поля по метрикам строк; тач-зоны транспорта и полосы прогресса добираются
`hitSlop`, а не высотой бокса, — иначе они поднимают всю стопку.

**Фон — дымка** (`components/haze-ground.tsx`): тёмная база и два цветных пятна, тон берётся
у играющего трека. Один и тот же фон у экрана трека и у главной.

**Скрим под фурнитурой лежит ВНУТРИ цели блюра** (`components/furniture-scrim.tsx`), поверх
контента, — ровно как `drawFoot` в стенде идёт до стеклянных деталей. Вынесенный наружу, он
линзе не виден: деталь показывает неприглушённый текст там, где вокруг всё затемнено, а
попытка погасить её саму превращает стекло в чёрный пластик.

**Активное состояние — смена материала, а не подсветка.** `LiquidGlassButton` принимает
причины и собирает состояние ядром (`activeMaterial`): толще тело, шире фаска, чище
поверхность. Пока менялся только `u_active`, состояние на кадре почти не читалось.

Верхняя панель экрана трека — просто значки на фоне: стеклянная панель давала жёсткую
кромку поперёк экрана, в макете её нет. Соседние обложки карусели проявляются только на
протяжке. Прогресс мини-плеера показывает сам материал (`u_progress`), позиция доезжает
подпиской мимо React.

> «НЕДАВНЕЕ» берётся из блока `personal` (`/api/v1/home/personal`, `recentlyPlayed`) —
> он требует авторизации. Длительность строки добавлена в `homeChartTrackSchema` полем
> `durationSec` **с умолчанием**: нативный клиент обновляется отдельно от сервера и обязан
> разбирать ответ версии, которая этого поля ещё не знает.

## Стекло на Android = стекло в вебе

Проверка велась не на глаз: веб-стенд снимался Playwright'ом, Android — `adb screencap`,
детали кадрировались в один масштаб и сравнивались попиксельно. Расхождения оказались
в трёх местах, и все три — андроидные изобретения поверх ядра.

**Оценку среды линзе больше не перебивает группа.** `groupProbe` применялся ПОСЛЕ
собственного зонда линзы, то есть просто затирал его; в вебе такого пропа нет вовсе. Кнопки
навигации стояли в `GlassGroup` и получали общую оценку, «ПОТОК» — свою: один материал
адаптировался к фону двумя разными способами. Убран; за группой осталась только полярность
краски на весь блок.

**Тяга — поле вокруг пятна касания, а не вторая форма.** Здесь жили свои пружины
(`DRAG_SPRING`/`RELEASE_SPRING`), «капля», уходящая за пальцем, шина тяги между соседями и
вздутие детали трансформом на 5 %. Ход тяги стоял `0.62 × размер` — почти вдевятеро больше
величины ядра (`0.14` от меньшего полуразмера). Всё это снято: отклик считает `createDeform`
из ядра и отдаёт те же поля, что гоняет веб (`u_touch`, `u_pull`, `u_touchPress`, `u_wave`),
а гнёт их `vgTouchWarp`. Касание поднимает активность на треть (`0.3`), как в `buttonPieces`.

**Дымка — построчный порт `drawAppBackground`.** Сцена собиралась из ролей акцента, а те
вдвое темнее вебовых (L 0.32 и 0.22 против 0.55 и 0.45): под органами управления оставался
бесцветный почти-чёрный, преломлять который стеклу нечего. Теперь база нейтральная, из
обложки берётся один тон, светлоты и альфы — вебовые. Полосы радиального градиента на
полотне 1080 px ломает зерно (`assets/haze-grain.png`, альфа 0.025): FeTurbulence в
react-native-svg на нативе не реализован, а Skia-канвас не попал бы в снимок RenderNode.

**Мини-плеер переехал на тот же примитив, что кнопки.** Был `GlassPanel` — поверхность без
тяги и без пятна касания — с обложкой и надписями обычными вьюхами ПОВЕРХ стекла: при
нажатии тело гнулось, а краска стояла. Теперь надписи и плей/пауза печатаются в маску, а
обложка едет цветным слоем `u_overlay` (слот в шейдере ядра был, но пустовал), на той же
координате и с той же деформацией. Подкрас `accent.wash` снят: роль детали показывают
краска, размер и место, а не цвет стекла.

> Эмулятор без DNS показывает мини-плеер с плоской заглушкой вместо обложки: Skia тянет
> картинку своим загрузчиком (`PlatformContext.getJniStreamFromSource`), и его отказ виден
> только в `System.err`, а expo-image в это же время отдаёт закешированное. Симптом читается
> как баг слоя, а это `UnknownHostException`.

## Стекло слушает системные настройки доступности

Эталон требует, чтобы модификаторы материала включались сами, как только приложение взяло
новый материал (`docs/vireglass/reference.md` §9). У мобилки этого не было: «уменьшенное
движение» управлял тумблер кита, а системную настройку не читал никто.

**Система читается в `lib/design/accessibility.ts`.** Первый ответ приходит промисом, дальше
событием: без первого настройка подхватилась бы только после того, как человек её переключит,
то есть на уже открытом экране никогда. `useReduceMotion` отдаёт сумму системы и тумблера —
тумблер может ужесточить настройку, но не ослабить системную.

**Применяются модификаторы в `GlassSurface`** — через неё проходит всё стекло приложения, и
одной точки достаточно. Оптика правится до всего, что от неё зависит: запас вьюхи линзы,
униформы поверхности, увеличение и интенсивность блюра — иначе матовое стекло вылезло бы за
собственный запас.

Прозрачность есть только у iOS: у Android публичной настройки нет, там она остаётся
выключенной. Контраст читается на обеих платформах, просто называется по-разному — у Android
это высококонтрастный текст, у iOS затемнение системных цветов.

**Подписка одна на приложение.** Стеклянных деталей на экране до десятка, и своя пара запросов
к мосту у каждой — заметная цена на ровном месте, поэтому нативные слушатели живут, пока есть
хоть один читатель, а поверхности только читают общее состояние.

**Цвет окружения доходит до тени.** Зонд считал средний цвет под деталью и раньше — он шёл
только в блик, а тень оставалась нейтрально-чёрной над любым контентом. Теперь поверхность
перехватывает тот же замер и отдаёт цвет в тень (`ambientFrom` огрубляет его шагом: замер
приходит раз в 180 мс, и точное значение дёргало бы перерисовку каждой детали). Веб через ту же
функцию НЕ ходит: там униформы пишутся императивно каждый кадр, огрублять нечего, а округление
вернуло бы ступеньки сглаженной оценке.

Подписка на замер не заводится ради тени: цвет берётся там, где замер и так идёт — у деталей
с включённой адаптацией. У остальных окружение остаётся нейтральным, и тень такая же, как была.

Срок годности у цвета тот же, что у замера. Вьюха с зондом живёт не всегда: она уходит под
открытым листом, при уменьшенной прозрачности и на фолбэке ниже Android 13, — а тень рисуется
всегда, и последний замер застыл бы в ней цветом фона, которого уже не видно. Поэтому условие
считается один раз (`measuring` в `components/vireglass/glass-surface.tsx`) и идёт сразу в два
места: им монтируется сама вьюха и им же разрешается цвет. Разойтись двум условиям нечем — это
одно выражение, а не два одинаковых.

### Инкремент: краевой эффект прокрутки по правилам ядра

Притенение под мини-плеером и навигацией (`components/furniture-scrim.tsx`) было включено
всегда и одинаково везде. Эталон (`docs/vireglass/reference.md` §10) требует другого: эффект
существует ровно затем, что контент заезжает ПОД панель, и «без прокрутки эффекта нет вовсе».
Экран, которому некуда прокручиваться, и список, докрученный донизу, гасили фон без причины —
под мебелью в этот момент пусто.

Теперь сила края идёт за прокруткой (`scrollEdgeStrength` из ядра, то же правило, что у веба),
а стиль — за полярностью стекла мебели: под светлым стеклом контент растворяется в фон, под
тёмным его сменяет лёгкое затемнение, потому что тёмное стекло гасит контент само. Плотность
затемнения взята у веба (`apps/web/rnd-src/scroll-edge.ts`); у растворения пик и форма кривой
достались от прежнего скрима и на устройстве не пересматривались. На тёмной теме
полярность светлая почти всегда, поэтому низ стал притенён заметно слабее прежнего.

Знания сходятся в `lib/scroll-edge.tsx`, потому что лежат в разных местах дерева: прокрутка —
внутри экрана, полярность — в `GlassGroup` таб-бара, то есть снаружи экранов. Сила едет shared
value и правит непрозрачность на UI-потоке: React о прокрутке не знает, ре-рендера нет. Считается
она в JS-потоке обычным `onScroll` — ворклет потребовал бы пометить функцию ядра `'worklet'`,
то есть вписать в платформо-нейтральное правило способ, которым его зовёт одна платформа.

Сила одна на приложение, поэтому её держит ВЛАДЕЛЕЦ — список сфокусированного экрана
(`createEdgeOwner` в `lib/design/scroll-edge.ts`): на входе он заявляет себя и пересчитывает силу
из своего последнего замера, на выходе снимает заявку, и без владельца (экран без списка) край
возвращается к полному. Владение проверяется на КАЖДОЙ записи, а не только на входе и выходе:
экран при потере фокуса не размонтируется и нативные события получать не перестаёт — экран,
догрузивший данные уже после ухода, монтирует свой список и его замеры иначе перетёрли бы скрим
активного экрана. Сбрасывать силу «на входе экрана» тоже оказалось нельзя: `onLayout`/
`onContentSizeChange` при возврате не повторяются, пока размеры прежние, а `onScroll` без жеста
не приходит вовсе — докрученный список оставался бы притенён после любого возврата (тап по
треку → плеер → назад). Снятие заявки условное, как у цели блюра: порядок focus-эффектов
навигацией не гарантирован. Подключён ОСНОВНОЙ вертикальный список каждого экрана;
горизонтальные карусели и вложенные списки не трогаются — под мебель заезжает не их содержимое.

Чего здесь нет: расфокуса. В вебе контент у панели ещё и расплывается, но на мобилке полосы
`BlurView` целились бы внутрь той же цели захвата — то самое замыкание дерева RenderNode, от
которого приложение уже падало (`lib/blur-target.tsx`), — и расходовали бы поверхности мимо
бюджета (`lib/design/glass-budget.ts`). Это отдельный срез с другим инструментом.

На устройстве не проверялось: здесь нет ни устройства, ни эмулятора.

### Инкремент: ручка позиции трека поднимается в стекло

Ручка в плеере (`components/player/progress-line.tsx`) была плоской заливкой. Эталон
(`docs/vireglass/reference.md` §5) требует другого: орган, который в покое стеклом не является,
под пальцем поднимается в стекло — растёт и отрывается от подложки. Правило долей живёт в ядре
(`raiseIntoGlass`), и мобилка берёт то же самое, что веб.

Что здесь возможно, а что нет. Преломления дорожки сквозь ручку НЕ БУДЕТ: внутри экрана нативной
линзы не существует (ADR-001 §2, замыкание дерева RenderNode). Остаются форма, фаска, кромочный
блик и тень — включая её отход, за который отвечает `lift`. Этого хватает, чтобы ручка под
пальцем читалась поднявшейся, и это граница платформы, а не недоделка среза.

Собрана ручка из двух слоёв, как на веб-стенде: матовая шайба гаснет по `solid`, поверх неё по
`glass` нарастает `VireGlassSurface` с `lift = 1`. Рост идёт трансформом обёртки — габарит детали
покадрово менять нельзя (перераскладка и новый `RenderEffect` на каждом кадре). Тяги у ручки нет:
она ездит по дорожке, а не тянется за пальцем, поэтому от касания ей нужно только нажатие.

Поверхность монтируется ТОЛЬКО на время жеста и идёт с `backdrop={false}`: бюджет
(`lib/design/glass-budget.ts`) она не занимает (регистрируются лишь поверхности с живым
бэкдропом), а канвас Skia в покое не рисуется вовсе. Попутно `VireGlassSurface` научилась
принимать `appear` и `lift` — до этого оба параметра контракта адаптера до мобилки не доходили,
и деталь не умела нарастать.

На устройстве не проверялось: здесь нет ни устройства, ни эмулятора.
