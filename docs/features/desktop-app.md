# Десктоп-клиент

Нативная оболочка Tauri v2 вокруг уже готового веб-фронта VireMusic: окно грузит
веб-страницу по URL. Срез 0 — сама оболочка (`docs/superpowers/specs/2026-08-16-desktop-shell-slice-0-design.md`).
Срез 1 — системный трей и OS-медиа-клавиши поверх неё
(`docs/superpowers/specs/2026-08-16-desktop-shell-slice-1-design.md`), см. «Трей и
медиа-клавиши» ниже. Проверяет связку Tauri + существующий веб на реальной
не-браузерной платформе — дешевле и раньше мобильного клиента
(`docs/multiplatform.md` §3.2, §12 п.7).

## Что делает

- Открывает окно «VireMusic» (1280×800, resizable, минимум 960×600), которое грузит
  `http://localhost:3000` в dev-сборке и `https://viremusic.ru` в релизной — выбор по
  `cfg!(debug_assertions)` на этапе компиляции, тот же паттерн, что `NEXT_PUBLIC_SITE_URL`/
  `AUTH_URL` в вебе (`apps/web/lib/site.ts`).
- Сессия — та же cookie-аутентификация Auth.js, что и в браузере: webview ничем не
  отличается от обычной вкладки с точки зрения сервера.
- Системный трей (левый клик — показать/сфокусировать окно; правый — меню Play/Pause/
  Следующий/Предыдущий/Выход) и OS-медиа-клавиши Play/Pause/Next/Previous — срез 1,
  подробности в «Трей и медиа-клавиши» ниже.

## Трей и медиа-клавиши (срез 1)

Мост Rust → веб — **`WebviewWindow::eval(js)`, не Tauri IPC**: окно грузит внешний
origin (`localhost:3000`/`viremusic.ru`), и включать туда IPC
(`dangerousRemoteDomainIpcAccess`) означало бы выдавать продовому JS права на
IPC-канал ради fire-and-forget команд плеера — несоразмерный риск. `eval` — обычный
оконный API, работает независимо от origin и не даёт странице встречных прав.

- `apps/web/lib/desktop-bridge.ts` — на импорте выставляет
  `window.__vireDesktopBridge = { togglePlay, next, prev }`, обёрнутые вызовы
  `controls.*` из `apps/web/lib/player/audio-engine.ts`. В браузере просто не
  используется. Подключён side-effect импортом (`import '@/lib/desktop-bridge'`) в
  `apps/web/components/player/index.tsx` — координаторе глобального плеера,
  который всегда смонтирован (через `PlayerWrapper` в корневом `app/layout.tsx`),
  независимо от того, играет ли что-то сейчас.
- `apps/desktop/src-tauri/src/bridge.rs` — `call_bridge(window, method)`: формирует
  `window.__vireDesktopBridge && window.__vireDesktopBridge.<method>()` и вызывает
  `window.eval`. Единственный путь команд в веб-страницу — общий для трея и медиа-клавиш.
- `apps/desktop/src-tauri/src/main.rs` — `tauri::tray::TrayIconBuilder` (меню «Показать
  VireMusic» / Play-Pause / Следующий / Предыдущий / Выход, левый клик по иконке —
  показать+фокус окна) и `tauri_plugin_global_shortcut` (Play/Pause/Next/Previous
  зарегистрированы как `Code::MediaPlayPause`/`MediaTrackNext`/`MediaTrackPrevious` без
  модификаторов). Оба обработчика зовут `call_bridge`, ничего не дублируют.
- Пункты меню и медиа-клавиши — статичные fire-and-forget команды, без синхронизации
  подписи/иконки с реальным состоянием воспроизведения (нужен канал веб→Rust, не в
  этом срезе).

**OS-медиа-клавиши на Windows: подтверждено, что плагин их ловит.** Проверено эмпирически
(`cargo tauri dev`, реальный трек через обычный UI плеера, медиа-клавиши эмулированы через
`keybd_event`/`VK_MEDIA_PLAY_PAUSE`/`VK_MEDIA_NEXT_TRACK`/`VK_MEDIA_PREV_TRACK` — то же, что
шлёт физическая мультимедиа-клавиатура) — Play/Pause дважды переключил реальное
воспроизведение в открытом окне, Next перевёл на следующий трек очереди. Опасение из
дизайн-документа (плагин рассчитан в первую очередь на обычные хоткеи типа `Ctrl+Shift+P`,
поддержка нативных multimedia-клавиш могла быть неполной) не подтвердилось — `Code::MediaPlayPause`
и соседние варианты существуют в API плагина и реально перехватываются `RegisterHotKey`
на Windows.

## Где код

- `apps/desktop/src-tauri/Cargo.toml` — крейт `vire-desktop`, зависимости `tauri` `^2`
  (фича `tray-icon`), `tauri-plugin-global-shortcut` `^2`, `tauri-build` `^2`.
- `apps/desktop/src-tauri/src/main.rs` — `shell_url()`, `WebviewWindowBuilder` с
  `WebviewUrl::External`, трей и глобальные медиа-шорткаты (срез 1).
- `apps/desktop/src-tauri/src/bridge.rs` — `call_bridge`, см. выше.
- `apps/web/lib/desktop-bridge.ts`, `apps/web/components/player/index.tsx` — веб-мост, см. выше.
- `apps/desktop/src-tauri/tauri.conf.json` — `productName`, `identifier`
  (`ru.viremusic.desktop`), `app.windows: []` (окно создаётся вручную в `main.rs`,
  не статическим конфигом — проще переключать dev/prod URL).
- `apps/desktop/src-tauri/capabilities/default.json` — `core:default` на окно `main`.
  Трей и `global-shortcut` управляются целиком из Rust (не через `invoke` со стороны
  JS) — Tauri-permissions гейтят только команды, вызываемые из веб-страницы, поэтому
  для них не понадобилось новых записей в capabilities.
- `apps/desktop/src-tauri/icons/` — набор иконок, сгенерирован `cargo tauri icon` из
  `apps/web/public/icon-512.png`; те же иконки переиспользованы для иконки трея
  (`app.default_window_icon()`).
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

Список — сознательно не в этих срезах (см. `docs/multiplatform.md` §3.2 «что даёт
десктоп поверх PWA практически», следующие срезы):
- Синхронизация состояния — подпись «Play»/«Пауза» в трее и на медиа-клавишах не
  отражает реальное воспроизведение (fire-and-forget команды, без канала веб→Rust)
- Мини-плеер поверх других окон (отдельное окно/оверлей)
- Глобальные хоткеи произвольных сочетаний (`Ctrl+Shift+P` и т.п.) — только сами
  медиа-клавиши Play/Pause/Next/Previous
- Автозапуск при входе в систему
- Нативный доступ к локальной библиотеке файлов сверх того, что уже даёт веб
- Код-сайнинг, автообновление, полировка инсталлятора
- Bearer/device-auth для десктопа (нужен только нативному UI вне webview; пока
  webview использует ту же cookie-сессию, что и браузер)
- `dangerousRemoteDomainIpcAccess` / любой Tauri IPC-доступ веб-странице — сознательно
  не открываем, весь мост в одну сторону через `eval` (см. «Трей и медиа-клавиши» выше)
- macOS/Linux-сборка не проверялась (машина разработки — Windows; Tauri v2
  кросс-платформенный, но верифицировано только то, что реально собирается здесь)
- Иконка трея — тот же PNG/ICO, что у окна и PWA, не отдельный брендинг; иконка без
  `.tooltip()` — на Windows 11 попадает в скрытые/overflow-иконки области уведомлений
  без подписи, пользователю придётся один раз её туда «найти» (закрепить вручную)
