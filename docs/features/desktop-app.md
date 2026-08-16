# Десктоп-клиент (срез 0 — оболочка)

Минимальная нативная оболочка Tauri v2 вокруг уже готового веб-фронта VireMusic: окно
грузит веб-страницу по URL, без нового UI и без нативных фич. Проверяет связку
Tauri + существующий веб на реальной не-браузерной платформе — дешевле и раньше
мобильного клиента (`docs/multiplatform.md` §3.2, §12 п.7).

## Что делает

- Открывает окно «VireMusic» (1280×800, resizable, минимум 960×600), которое грузит
  `http://localhost:3000` в dev-сборке и `https://viremusic.ru` в релизной — выбор по
  `cfg!(debug_assertions)` на этапе компиляции, тот же паттерн, что `NEXT_PUBLIC_SITE_URL`/
  `AUTH_URL` в вебе (`apps/web/lib/site.ts`).
- Сессия — та же cookie-аутентификация Auth.js, что и в браузере: webview ничем не
  отличается от обычной вкладки с точки зрения сервера.
- Больше ничего: ни трея, ни хоткеев, ни доступа к ФС, ни автообновления — см.
  «Ограничения» ниже.

## Где код

- `apps/desktop/src-tauri/Cargo.toml` — крейт `vire-desktop`, зависимости `tauri`/`tauri-build` `^2`.
- `apps/desktop/src-tauri/src/main.rs` — весь Rust-код среза: `shell_url()` +
  `WebviewWindowBuilder` с `WebviewUrl::External`.
- `apps/desktop/src-tauri/tauri.conf.json` — `productName`, `identifier`
  (`ru.viremusic.desktop`), `app.windows: []` (окно создаётся вручную в `main.rs`,
  не статическим конфигом — проще переключать dev/prod URL).
- `apps/desktop/src-tauri/capabilities/default.json` — `core:default` на окно `main`;
  срез 0 не вызывает Tauri-команд (`invoke`), капабилити на будущее.
- `apps/desktop/src-tauri/icons/` — набор иконок, сгенерирован `cargo tauri icon` из
  `apps/web/public/icon-512.png`.
- `apps/desktop/frontend-stub/` — пустышка: Tauri требует существующий `frontendDist`
  в конфиге, даже когда окно всегда грузит внешний URL и локальные ассеты не используются.
  Не переименовывать в `dist/` — под этим именем каталог глобально в `.gitignore`.
- `apps/desktop/package.json` — скрипты `tauri:dev`/`tauri:build` (не `dev`/`build`:
  корневой `turbo run dev`/`build` фанаутит на любой пакет со скриптом `dev`/`build`,
  а десктоп не должен запускаться при обычном `pnpm dev`).

## Как собрать и запустить

Пререквизиты (Windows):
- Rust stable (`rustup`, таргет `x86_64-pc-windows-msvc`) — `rustup-init.exe -y`.
- `tauri-cli`: `cargo install tauri-cli --version "^2"` (не npm-пакет — стандартный
  путь для Tauri v2).
- MSVC build tools (линковщик `link.exe`) — на этой машине их не было, ставились
  отдельно: `winget install --id Microsoft.VisualStudio.2022.BuildTools --override
  "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`. Без этого
  `cargo build` падает на этапе линковки (`link.exe` не найден), ошибка не про Tauri.
- WebView2 Runtime — на Windows 10/11 обычно уже установлен системой (Edge его тянет);
  на этой машине уже стоял (`151.0.4129.86`), отдельно не ставили.

Dev-режим (нужен запущенный веб на 3000):
```bash
pnpm --filter @vire/web dev          # в отдельном терминале, порт 3000
cd apps/desktop/src-tauri
cargo tauri dev
```

Прод-сборка:
```bash
cd apps/desktop/src-tauri
cargo tauri build
```
Артефакты (проверено 16.08.2026):
- `apps/desktop/src-tauri/target/release/bundle/msi/VireMusic_0.1.0_x64_en-US.msi`
- `apps/desktop/src-tauri/target/release/bundle/nsis/VireMusic_0.1.0_x64-setup.exe`

Иконки перегенерировать (после смены исходника):
```bash
cd apps/desktop/src-tauri
cargo tauri icon ../../web/public/icon-512.png
```
Команда заодно генерирует Android/iOS/Appx-варианты (Tauri поддерживает и мобильные
таргеты) — они не нужны срезу 0 и не референсятся в `tauri.conf.json`, поэтому
удалены из `icons/` вручную; при регенерации подчистить так же.

## Env

Не требуется — URL зашит на этапе компиляции (`cfg!(debug_assertions)`), не читается
из окружения в рантайме.

## Ограничения / на будущее

Список — сознательно не в этом срезе (см. `docs/multiplatform.md` §3.2 «что даёт
десктоп поверх PWA практически», следующие срезы):
- Медиа-клавиши ОС / управление с гарнитуры
- Глобальные хоткеи при свёрнутом окне
- Системный трей + мини-плеер поверх окон
- Автозапуск при входе в систему
- Нативный доступ к локальной библиотеке файлов сверх того, что уже даёт веб
- Код-сайнинг, автообновление, полировка инсталлятора
- Bearer/device-auth для десктопа (нужен только нативному UI вне webview — трею
  и т.п.; пока webview использует ту же cookie-сессию, что и браузер)
- macOS/Linux-сборка не проверялась (машина разработки — Windows; Tauri v2
  кросс-платформенный, но верифицировано только то, что реально собирается здесь)
- Иконка — тот же PNG, что у PWA, не финальный брендинг для десктопа
