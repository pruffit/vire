# Мобильное приложение (инкременты 1–5)

React Native + Expo клиент: auth → навигация → каталог → воспроизведение звука → SDUI-главная
+ нативная полировка. Инкремент 1 — дизайн в
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
(`.npmrc` → `virtual-store-dir-max-length`), вход и данные подтверждены живьём на эмуляторе,
но **воспроизведение падает детерминированным крашем в `MusicService.emit()` при первом
тапе play** — см. секцию ниже, это текущий блокер живой проверки лок-скрина/фона.

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
  приложении. Shuffle/repeat, оффлайн, лайки/плейлисты из мобилки — вне скоупа (см. ниже).
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

**Код написан, типизирован, покрыт тестами и прошёл ревью — живая проверка на устройстве
НЕ завершена.** Не заявлять «работает на лок-скрине», пока это не подтверждено фактом на
следующем прогоне.

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

## Вне скоупа (следующие шаги)

- **Краш `MusicService.emit()` при первом `play()`** — см. «Живая проверка на эмуляторе»
  выше, первый шаг следующей сессии. Сеть/сборка/вход больше не блокеры.
- Shuffle/repeat-UI, оффлайн-скачивание, лайки/добавление в плейлист из мобилки — сами
  функции очереди в `@vire/core` уже есть на будущее, UI сознательно не добавлен.
- Пуши, диплинки на конкретный трек/релиз, биометрия, шеринг, виджеты.
- iOS-сборка и запуск на реальном устройстве — не проверялись (нет Mac); `app.json` пишет
  конфиг под обе платформы, но реально верифицирован только веб-превью (`react-native-web`)
  и, для Android, эмулятор.
- **Android SDK/эмулятор — с инкремента 4 есть** (`VireMusic_Test`, API 36, `ANDROID_HOME=
  C:\Android`, `pnpm --filter @vire/mobile mobile:android` для managed-запуска через Expo
  Go/dev-client, `npx expo run:android` для локальной сборки с нативными зависимостями типа
  RNTP). Следующая сессия должна использовать его по умолчанию, не откладывать на «появится
  телефон» — реальное воспроизведение, фоновый режим, lock-screen, predictive back gesture,
  визуальный pull-to-refresh, end-to-end вход через Expo Go всё ещё не проверены этой
  сессией и остаются первым шагом следующей.
