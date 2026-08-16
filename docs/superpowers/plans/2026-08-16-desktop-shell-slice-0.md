# План — десктоп-клиент, срез 0 (оболочка)

Спека: `docs/superpowers/specs/2026-08-16-desktop-shell-slice-0-design.md`.

## Шаги

1. **Toolchain**: поставить Rust (`rustup`, stable) и `tauri-cli` (`cargo install
   tauri-cli --version "^2"` — стандартный путь для Tauri v2, не npm-пакет). Проверить
   `cargo --version`, `rustc --version`, `cargo tauri --version` после установки.
2. **Скаффолд `apps/desktop`**: `pnpm create tauri-app` (или ручной `cargo tauri init`
   внутри `apps/desktop`) — выбрать вариант без фронтенд-фреймворка (frontend уже есть,
   это чистая обёртка, не новый Vite/React проект). Структура: `apps/desktop/src-tauri/`
   (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`), без `apps/desktop/src` веб-кода —
   webview грузит внешний URL, а не локальные файлы.
3. **`tauri.conf.json`**: `productName: "VireMusic"`, `identifier` (reverse-domain,
   например `ru.viremusic.desktop`), окно с разумным дефолтным размером (например
   1280×800, `resizable: true`), `devUrl`/`frontendDist` — для среза 0 URL берётся из
   Rust-кода (`src/main.rs`), не из `tauri.conf.json` static build (проще для env-переключения
   dev/prod, см. спеку).
4. **`src/main.rs`**: минимальный Tauri v2 setup — создать окно, `WebviewWindowBuilder`
   с URL из константы/env на этапе компиляции (`cfg!(debug_assertions)` → localhost:3000,
   иначе `https://viremusic.ru`).
5. **Иконка**: взять существующий ассет из `apps/web/public` (проверить, что там есть
   подходящий квадратный PNG высокого разрешения — иначе сгенерировать из `Logo`
   компонента/favicon), прогнать через `cargo tauri icon <путь>` — сгенерирует набор
   под все платформы автоматически.
6. **Проверка**: `cargo tauri dev` (нужен запущенный `pnpm --filter @vire/web dev`
   локально на 3000 для dev-режима — если инфраструктура/дев-сервер не подняты, поднять)
   — окно открывается, страница грузится, не падает. `cargo tauri build` — собирает
   Windows-инсталлятор (`.msi`/`.exe` NSIS, что выберет Tauri по умолчанию), путь к
   артефакту зафиксировать в отчёте.
7. **`docs/features/desktop-app.md`** по шаблону `docs/features/README.md`: что делает,
   где код, как собрать (`cargo tauri dev`/`build`), системные пререквизиты (Rust,
   WebView2 runtime на Windows — обычно уже есть в Windows 10/11, но упомянуть),
   ограничения среза (список «не входит» из спеки).
8. **`docs/multiplatform.md`**: в таблице §2 у строки Desktop статус остаётся «строим»
   (срез 0 не завершает клиент), но добавить короткую заметку о том, что срез 0 сделан
   и что именно он проверяет (аналогично заметкам у SDUI/токенов).

## Гейты

Это не веб-код — `pnpm --filter @vire/web ...` гейты не относятся к `apps/desktop`
напрямую. Проверка — сама компиляция/запуск (шаг 6). Если `apps/desktop` заведёт свой
`package.json` (для скриптов `tauri dev`/`tauri build` через pnpm) — добавить его в
корневой `pnpm-workspace.yaml`, если он ещё не покрыт wildcard `apps/*` (проверить).
`pnpm install` в корне после добавления нового пакета — стандартно.

## Делегирование

Реализация целиком — один сабагент (Sonnet), **в фоне**: установка Rust-тулчейна и
первая компиляция Tauri занимают десятки минут, это не блокирующая работа для
оркестратора. Самокритика отдельным прогоном не нужна — весь смысл среза 0 в том, что
он либо реально собирается и запускается, либо нет; фиктивной проверки тут не поставить,
а живая проверка уже часть плана (шаг 6).
