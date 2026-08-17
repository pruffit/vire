# Мобильное приложение — инкремент 1: план реализации

Дизайн: `docs/superpowers/specs/2026-08-17-mobile-app-increment-1-design.md` (не пересматривать).

## Готово (эта сессия, вручную, до делегирования)

- `apps/web/app/mobile-auth-bridge/page.tsx` + `layout.tsx` — Server Component, зовёт
  `deviceAuthService().register()` (тот же сервис, что `POST /api/v1/auth/devices`), редирект
  на `vire://auth-callback?accessToken&refreshToken&deviceId`; нет сессии → `/sign-in`;
  rate-limit `device-register` (тот же бакет, что у JSON-роута) через локальный IP-ключ
  (`headers()` вместо `Request`, `clientKey()` не трогали — используется в 21 файле).
- `apps/web/proxy.ts` — `/mobile-auth-bridge` в `UNLOCALIZED_PREFIXES` + отдельная ветка
  `NextResponse.next()` до `handleI18nRouting`, иначе next-intl 404'ит несуществующий
  `[locale]/mobile-auth-bridge`.

## Осталось (делегировать одним сабагентом, Sonnet, полный контекст в брифе)

1. **RN-таргет design-tokens** — `packages/design-tokens/src/generate.ts`: чистая функция
   `generateNative(tokens)` (OKLCH → sRGB hex, конвертация внутри функции, без внешних либ) +
   тест на конкретное значение; `scripts/build.mjs` пишет `dist/tokens.native.ts`;
   `package.json` exports добавляет `"./native"`.
2. **`@vire/api-client` — headers в `request()`** — `packages/api-client/src/http.ts`:
   опциональное поле `headers?: Record<string,string>` в `RequestOptions<T>`, мёржится в
   fetch-заголовки (Content-Type не перетирать). Обратная совместимость — существующие вызовы
   без `headers` не меняют поведение. Переиспользуется мобилкой для `Authorization: Bearer`
   вместо форка HTTP-обвязки.
3. **Scaffold `apps/mobile`** (`@vire/mobile`, Expo managed + TS, попадает в workspace через
   `apps/*` в `pnpm-workspace.yaml` автоматически). Скрипты **не** `dev`/`build` (турбо
   фанаутит `pnpm dev`/`pnpm build` из корня на любой пакет с таким скриптом — паттерн
   `apps/desktop/package.json`): `mobile:start`, `mobile:web` (`expo start --web`),
   `mobile:android`, плюс `typecheck` (`tsc --noEmit`, обычное имя — турбо уже фанаутит
   `turbo run typecheck` без явного скоупа, CLAUDE.md). `app.json`: `scheme: "vire"` (нужен
   для `vire://auth-callback`).
4. **Auth**: `expo-secure-store` (accessToken/refreshToken/deviceId), `expo-web-browser`
   `openAuthSessionAsync(webBaseUrl + '/mobile-auth-bridge?platform=...&name=...', 'vire://auth-callback')`.
   Единый клиент поверх `@vire/api-client` `request()` — интерцептор добавляет
   `Authorization`, на 401 гоняет `POST /api/v1/auth/refresh` (схемы из
   `@vire/api-contracts/device-auth`) один раз и повторяет исходный запрос. Env — 
   `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_BASE_URL` (фолбэк `http://localhost:3000`,
   как веб-дефолт).
5. **Навигация**: native-stack (экран входа) оборачивает bottom-tabs (Главная/Поиск/
   Медиатека/Профиль). Поиск/Медиатека/Профиль — честные заглушки под IA.
6. **Главная**: `GET /api/v1/releases?sort=fresh&limit=24` (публичный, без авторизации,
   `releaseCatalogResponseSchema` из `@vire/api-contracts`) — нативный скролл-список обложек,
   press-состояния. Тёмная тема, цвета из `dist/tokens.native.ts` (п.1).
7. **Гейты**: веб — typecheck/lint/check:routes/check:i18n/check:contracts/test/build;
   `packages/design-tokens` и `packages/api-client` — typecheck/test; мобилка — `typecheck`.
8. **Верификация**: `npx expo start --web` реально открыт, реальные данные релизов видны;
   `mobile-auth-bridge` проверен на реальном `pnpm --filter @vire/web dev` (минимум —
   неавторизованный запрос редиректит на `/sign-in?callbackUrl=/mobile-auth-bridge`; по
   возможности — залогиненной сессией curl'ом до реального `vire://...` редиректа с непустыми
   токенами). Убрать все фоновые процессы (`expo`, `next dev`) после проверки.
9. **`docs/features/mobile-app.md`** — обязателен: что сделано, как запустить, auth-flow,
   вне скоупа (звук — следующий шаг, нужен `IAudioEngine`), честно — что не проверено на
   реальном устройстве.

Не в скоупе: воспроизведение звука, оффлайн, пуши, диплинки на трек/релиз, iOS-сборка,
Android SDK/эмулятор/Expo Go на реальном устройстве (руки человека).
