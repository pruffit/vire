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
  `HOT_TRACKS_LIMIT=20` в `packages/core/.../home-blocks.ts`) — клиентского лимита не
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
  зависимостей) и `generateNative()`; `scripts/build.mjs` пишет `dist/tokens.native.ts`;
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
`lib/env.ts` теперь выводит базовый URL автоматически: `EXPO_PUBLIC_*` env (если задан) →
LAN-хост из `Constants.expoConfig?.hostUri` (адрес, на котором Metro раздаёт бандл
телефону) на порту 3000 → `http://localhost:3000` (фолбэк для `expo start --web`, где
`hostUri` не заполняется). Next dev-сервер почти всегда поднят на той же машине, что и
Metro, поэтому LAN-хост совпадает.

- `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WEB_BASE_URL` — задавать явно только когда
  автоопределение не подходит: dev-сервер `@vire/web` слушает не на 3000, Wi-Fi изолирует
  клиентов друг от друга (client isolation), или тестируешь против удалённого стенда.
  Шаблон — `apps/mobile/.env.example`. **Android-эмулятор — отдельный случай, где
  автоопределение НЕ подходит по умолчанию:** `Constants.expoConfig?.hostUri` внутри
  эмулятора не указывает на хост-машину напрямую — нужен явный
  `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:<порт>` (`10.0.2.2` — стандартный алиас
  хост-машины для Android-эмулятора, не LAN IP).

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
    `use-intl` → `packages/i18n/src/translator.ts` → `packages/core/.../email-templates.ts`
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
  (`apps/web/app/(listener)/friends/page.tsx` вызывает `FriendshipService.listIncoming`
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
  событие обеим сторонам — подтверждено чтением `packages/core/.../chat.ts:63-65` на
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
    `packages/core/.../chat.ts:87-98`).
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

### Блокер: нет Expo/EAS-проекта

`getExpoPushTokenAsync()` на Expo SDK 57 требует `projectId` в конфиге —
`apps/mobile/app.json` без `extra.eas.projectId`, EAS-проект не заведён, доступа к
аккаунту expo.dev у сессии не было. Для реальной доставки на Android дополнительно нужны
FCM-креды (Firebase-проект), загруженные в EAS credentials. **Решение по итогам
обсуждения с Даней (2026-08-23): построить весь код полностью, привязку
`projectId`/EAS/FCM оставить документированным ручным шагом** — тот же класс пробела, что
"нет Mac для iOS". Без него `registerForPushNotifications()` детерминированно уходит по
ветке "нет projectId" и ничего не отправляет — код рабочий и протестирован юнит-тестами,
но **живая проверка на эмуляторе (свернуть → прислать сообщение → увидеть системный
пуш) не проводилась и не могла быть проведена** в этой сессии. Следующий шаг: завести
привязку EAS-проекта (например `eas init` с Personal Access Token в `apps/mobile/.env`
как `EXPO_TOKEN`, не пастить токен в чат) + Firebase-проект для FCM, затем повторить
живой прогон.

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

### Осознанно не в этом инкременте

Живая проверка на эмуляторе (блокер выше). Опрос `/getReceipts` Expo API для полной
пруны протухших токенов. Отдельная настройка "пуш на телефон" вместо телефона отдельно
от браузера. Deep-link по тапу на конкретный чат/экран. Каскад пруны `expo_push_tokens`
при массовом отзыве всех устройств (`DeviceAuthService.refresh()` → `revokeAllForUser`
при обнаружении компрометации refresh-токена) — закрыт только явный отзыв одного
устройства и logout, не сценарий "утечка токена".
