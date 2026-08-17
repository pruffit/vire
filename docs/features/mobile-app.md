# Мобильное приложение (инкремент 1)

React Native + Expo клиент, walking skeleton: связка auth → навигация → реальный экран
данных, без воспроизведения звука. Дизайн — `docs/superpowers/specs/2026-08-17-mobile-app-increment-1-design.md`.

## Что делает

- Таб-бар (native-stack → bottom-tabs): Главная — реальный список свежих релизов с
  `GET /api/v1/releases`; Поиск/Медиатека/Профиль — честные заглушки-стабы («Скоро»), не
  притворяются функциональными.
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
  - `navigation/root-navigator.tsx` — native-stack (SignIn/Main), решение о стартовом
    экране по наличию токенов в secure store.
  - `navigation/main-tabs.tsx` — bottom-tabs, 4 вкладки.
  - `screens/sign-in-screen.tsx`, `screens/home-screen.tsx` — рабочие экраны.
  - `screens/{search,library,profile}-screen.tsx` + `components/stub-screen.tsx` — заглушки.
  - `lib/env.ts` — `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_BASE_URL`, фолбэк localhost:3000.
  - `lib/secure-store.ts` — обёртка над `expo-secure-store` (accessToken/refreshToken/deviceId).
  - `lib/api-client.ts` — `apiRequest()`: Bearer из secure store + один повтор через
    `POST /api/v1/auth/refresh` на 401. Ни один экран инкремента 1 её не вызывает (Главная
    бьёт в публичный `/api/v1/releases` напрямую через `request()` из `@vire/api-client`,
    авторизованных вызовов пока нет) — модуль готов для первого экрана, которому
    понадобятся приватные данные.
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

## Проверено в этой сессии

- `npx expo start --web`: Metro поднимается без ошибок бандлинга, `GET /` отдаёт HTML с
  `<title>VireMusic</title>`, JS-бандл (`/apps/mobile/index.ts.bundle?platform=web...`)
  компилируется в 200 (~3.2 МБ) и содержит реальные строки кода (URL `/api/v1/releases`,
  hex-цвета темы, `vire://auth-callback`, ярлыки вкладок).
- `GET /api/v1/releases?sort=fresh&limit=24` на реальном `pnpm --filter @vire/web dev` —
  200, реальные 2 релиза из локальной БД (не заглушка).
- `mobile-auth-bridge` без cookie-сессии — `307` → `/sign-in?callbackUrl=/mobile-auth-bridge`
  (проверено `curl` на реальном dev-сервере). **Авторизованная ветка (реальный
  `vire://auth-callback?accessToken=...`) не проверена** — в локальной БД нет пользователя
  с паролем (единственный юзер вошёл через OAuth/magic-link), настраивать его ради этой
  проверки не стали (укладываемся в решение design-документа «не тратить на это больше
  15–20 минут — задокументировать как ограничение»). Код прочитан целиком и соответствует
  контракту `deviceAuthService().register()`.
- Все гейты веба (`typecheck`/`lint`/`check:routes`/`check:i18n`/`check:contracts`/`test`/
  `build`) и `apps/mobile`/`packages/design-tokens`/`packages/api-client` — зелёные.

## Вне скоупа (следующие шаги)

- **Воспроизведение звука** — нужен порт `IAudioEngine` (пока не вынесен из
  `apps/web/lib/player/audio-engine.ts`) + `react-native-track-player`, отдельный срез.
- Оффлайн, пуши, диплинки на конкретный трек/релиз.
- iOS-сборка и запуск на реальном устройстве через Expo Go — не проверялись в этой сессии
  (нет Mac и физического телефона на машине разработки); `app.json` пишет конфиг под обе
  платформы, но реально верифицирован только веб-превью (`react-native-web`).
- Android SDK/эмулятор — не установлены и не проверялись (нет `adb`/`java` на машине).
