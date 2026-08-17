# План: десктоп мини-плеер поверх окон

Спека: `docs/superpowers/specs/2026-08-17-desktop-mini-player-design.md`.

## Шаг 1 — веб: маршрут без chrome

- `apps/web/proxy.ts`: ветка `pathname.startsWith('/desktop/mini-player')` — passthrough
  (как `/fwqa688`) + форвард заголовка `x-desktop-chrome: none` через
  `NextResponse.next({ request: { headers } })`. Добавить `/desktop` в
  `UNLOCALIZED_PREFIXES` (кросс-локальный редирект `/en/desktop/...` → `/desktop/...`,
  как у `/admin`).
- `apps/web/app/layout.tsx`: читать заголовок (`headerLocaleOrDefault`-подобный хелпер),
  при `x-desktop-chrome: none` — не рендерить `Nav`/`ScrollState`/`ScrollRestoration`/
  `SitePresence`/`JamSessionProvider`/`PartyVideoDock`/`PlayerWrapper`/`MobileTabBar`/
  `DeferredWidgets`/чат-бутстрап/`YandexMetrika`, оставить `NextIntlClientProvider`+
  `MotionProvider` (страница всё ещё в дереве Next) и просто `{children}` внутри `body`.
  Проверить `app/__tests__/layout-shell.test.ts` не ловит регресс (новая ветка не должна
  нарушать инварианты для остальных страниц — diff должен быть чисто условным).
- `apps/web/app/desktop/mini-player/page.tsx` — top-level route (вне `[locale]`), клиентский
  компонент.

## Шаг 2 — веб: синк-модуль

- Расширить `apps/web/lib/desktop-bridge.ts` (или новый соседний файл, если чище): открыть
  `BroadcastChannel`, подписка на `usePlayerStore`, throttled broadcast + периодический тик
  во время игры, ответ на `requestState`, приём команд → существующие `controls.*`.
  Инициализация — рядом с уже существующим side-effect импортом в
  `apps/web/components/player/index.tsx` (тот же паттерн, что `desktop-bridge`/
  `media-session`).

## Шаг 3 — веб: UI мини-плеера

- `apps/web/app/desktop/mini-player/page.tsx` (или вынесенный компонент): обложка,
  marquee-название/артист, прогресс-бар, prev/play-pause/next, `data-tauri-drag-region`
  на корневой контейнер. Переиспользовать существующие иконки транспорта из
  `components/player/**`, не плодить копии.

## Шаг 4 — Rust: второе окно

- `apps/desktop/src-tauri/src/main.rs`: пункт трея «Мини-плеер» (`CheckMenuItem`),
  создание/show/hide `WebviewWindow` `"mini-player"` (параметры — см. спеку),
  `CloseRequested` → `prevent_close` + `hide` (по образцу главного окна, срез 4).
  `tauri-plugin-window-state`: не добавлять `"mini-player"` в denylist.

## Шаг 5 — эмпирическая проверка (Windows, `cargo tauri build` + реальный `.exe`)

Все пункты из раздела «Проверка» спеки. Скриншоты/логи — в отчёт по фиче.

## Шаг 6 — доки и гейты

- `docs/features/desktop-app.md`: секция «Мини-плеер», обновить «Ограничения» (убрать
  пункт из списка отложенного).
- Гейты: `pnpm --filter @vire/web typecheck/lint/check:routes/check:i18n/test/build`,
  `cargo tauri build` (оба бандла).
- Версия НЕ бампается в этом шаге — ship отдельным релизным коммитом после ревью.
