# Десктоп-клиент

Нативная оболочка Tauri v2 вокруг уже готового веб-фронта VireMusic: окно грузит
веб-страницу по URL. Срез 0 — сама оболочка (`docs/superpowers/specs/2026-08-16-desktop-shell-slice-0-design.md`).
Срез 1 — системный трей и OS-медиа-клавиши поверх неё
(`docs/superpowers/specs/2026-08-16-desktop-shell-slice-1-design.md`), см. «Трей и
медиа-клавиши» ниже. Срез 2 — `navigator.mediaSession` в веб-плеере
(`docs/superpowers/specs/2026-08-16-desktop-shell-slice-2-design.md`, скоуп сужен до
раздела 1 — раздел про Tauri IPC-команду синка подписи трея отложен), см. «Media
Session» ниже. Срез 3 — автозапуск при входе в систему
(`docs/superpowers/specs/2026-08-16-desktop-shell-slice-3-design.md`), см. «Автозапуск»
ниже. Срез 4 — сворачивание в трей по крестику и глобальный хоткей показать/скрыть
(`docs/superpowers/specs/2026-08-16-desktop-shell-slice-4-design.md`), см. «Сворачивание
в трей и глобальный хоткей» ниже. Срез 5 — единственный экземпляр процесса и память
размера/позиции окна (`docs/superpowers/specs/2026-08-16-desktop-shell-slice-5-design.md`),
см. «Единственный экземпляр и память окна» ниже. Срез 6 — сплэш-экран на холодном старте
(`docs/superpowers/specs/2026-08-16-desktop-shell-slice-6-design.md`), см. «Сплэш-экран»
ниже. Проверяет связку Tauri + существующий веб на реальной
не-браузерной платформе — дешевле и раньше мобильного клиента (`docs/multiplatform.md`
§3.2, §12 п.7).

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
- Текущий трек в системном виджете «Сейчас играет» (Windows SMTC) с обложкой/названием/
  артистом и управлением play/pause/next/prev оттуда — срез 2, подробности в «Media
  Session» ниже.
- Автозапуск при входе в систему, переключается чекбоксом в трее, по умолчанию
  выключен — срез 3, подробности в «Автозапуск» ниже.
- Крестик окна сворачивает в трей вместо закрытия процесса; глобальный хоткей
  `Ctrl+Alt+V` показывает/прячет окно из любого места — срез 4, подробности в
  «Сворачивание в трей и глобальный хоткей» ниже.
- Повторный запуск `.exe` не плодит второй процесс — фокусирует уже открытое окно (в
  т.ч. восстанавливает из трея); размер и позиция окна переживают перезапуск — срез 5,
  подробности в «Единственный экземпляр и память окна» ниже.
- На холодном старте вместо пустого окна ОС сразу виден маленький сплэш с логотипом,
  закрывающийся ровно в момент реальной готовности страницы — срез 6, подробности в
  «Сплэш-экран» ниже.

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

## Media Session (срез 2)

`apps/web/lib/player/media-session.ts` — обычный веб-код, не Tauri-специфика: подписка
на `usePlayerStore` (track/isPlaying) синкает `navigator.mediaSession.playbackState`
(`'playing'`/`'paused'`/`'none'`) и `.metadata` (title/artist/artwork), плюс
`setActionHandler('play'|'pause'|'previoustrack'|'nexttrack', …)` на существующие
`controls.togglePlay()/prev()/next()` (`apps/web/lib/player/audio-engine.ts`). Гард на
`'mediaSession' in navigator`. Инициализация — `initMediaSession()` рядом с
`initAudioEngine()` в `useEffect` координатора плеера (`apps/web/components/player/index.tsx`),
по тому же паттерну «эффект на верхнем всегда смонтированном компоненте», что и
side-effect импорт `desktop-bridge`.

**Проверено эмпирически (16.08.2026, `cargo tauri dev` + реальный трек через UI, CDP
`--remote-debugging-port` + WinRT `GlobalSystemMediaTransportControlsSessionManager`):**

- **SMTC подхватывает трек по факту.** Windows-сессия `msedgewebview2.exe` реально
  появляется с `Title`/`Artist`/`PlaybackStatus`, синхронно с `isPlaying` в сторе —
  WebView2 проксирует `navigator.mediaSession` в SMTC из коробки, без какого-либо
  Tauri-кода.
- **Дублирования медиа-клавиш с `tauri-plugin-global-shortcut` (срез 1) не обнаружено.**
  Три подряд эмуляции `keybd_event(VK_MEDIA_PLAY_PAUSE)` дали три чистых одиночных
  тоггла (playing→paused→playing→paused), без «двойного» переключения. Причина —
  оба пути физически не конкурируют: с обнулёнными `mediaSession`-обработчиками
  (`setActionHandler(..., null)`) физическая клавиша **по-прежнему** переключала
  воспроизведение — то есть на этой связке Windows-клавишу реально ловит только
  `tauri-plugin-global-shortcut` (`RegisterHotKey`), путь через `mediaSession`
  `setActionHandler` для той же физической клавиши не срабатывает вовсе. `mediaSession`
  в этой конфигурации даёт SMTC-виджет (метаданные/статус), а не альтернативный
  обработчик клавиш. **Решение: оба пути оставлены как есть**, `main.rs` не менялся —
  убирать регистрацию медиа-клавиш из `tauri-plugin-global-shortcut` не за что, реального
  конфликта нет.

## Автозапуск (срез 3)

Официальный `tauri-plugin-autostart` v2 (`apps/desktop/src-tauri/Cargo.toml`) —
регистрирует/снимает автозапуск через штатный Windows-механизм (registry-ключ
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`), ничего своего руками не пишет.
Управление — чекбокс-пункт «Запускать при входе в систему» (`CheckMenuItem`) в
существующем трей-меню (`apps/desktop/src-tauri/src/main.rs`), других поверхностей
управления нет (настроек-окна у приложения нет и не планируется). По умолчанию (первый
запуск) — выключен: состояние читается из `app.autolaunch().is_enabled()` при
построении меню, ничего не включается автоматически.

Обработчик клика — toggle через `app.autolaunch().enable()`/`.disable()`, затем
`CheckMenuItem::set_checked` на актуальное состояние. Плагин управляется целиком из
Rust (не через `invoke` со стороны веб-страницы) — новых записей в
`capabilities/default.json` не потребовалось, как и для трея/`global-shortcut` из
среза 1.

**Проверено эмпирически (16.08.2026, `cargo tauri dev`, реальное взаимодействие с
чекбоксом трея через физический клик, не программный вызов):** включение чекбокса
добавило запись `VireMusic` в `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
(значение — путь к `vire-desktop.exe`), выключение — запись пропала. Оба перехода
подтверждены через `reg query`, не только по отсутствию ошибки в консоли плагина.

## Сворачивание в трей и глобальный хоткей (срез 4)

`apps/desktop/src-tauri/src/main.rs`, оба улучшения независимы друг от друга и не
требуют канала веб→Rust:

- **Крестик = скрыть, не закрыть.** `WebviewWindow::on_window_event` перехватывает
  `WindowEvent::CloseRequested`: `api.prevent_close()` + `window.hide()`. Полный выход —
  только через пункт трея «Выход» (`app.exit(0)`, без изменений со среза 1).
- **Глобальный хоткей `Ctrl+Alt+V`** — добавлен в тот же
  `tauri_plugin_global_shortcut::Builder` (срез 1, уже регистрирует медиа-клавиши), не
  отдельный плагин. Обработчик: `window.is_visible()` → `hide()` либо `show()` +
  `set_focus()`. Работает независимо от того, свёрнуто окно в трей или нет.

**Проверено эмпирически (16.08.2026, `cargo tauri dev`, реальные события ОС — не
программные вызовы Tauri API):**
- `WM_CLOSE` в окно (тот же сигнал, что шлёт клик по крестику) — окно пропало
  (`MainWindowTitle` пустой), процесс `vire-desktop.exe` остался в `tasklist` с тем же PID.
- Эмуляция `Ctrl+Alt+V` через `keybd_event` — окно показалось обратно
  (`MainWindowTitle` снова `VireMusic`); повторное нажатие снова спрятало. Комбинация
  зарегистрировалась без конфликта на этой машине (Windows 11, VS Code, Яндекс.Браузер
  открыты) — конфликта с системными/браузерными хоткеями не обнаружено, менять не
  потребовалось.
- Пункт трея «Выход» — найден через UI Automation (иконка без tooltip уходит в скрытые
  значки области уведомлений, как и раньше), правый клик открыл меню со всеми пунктами
  («Показать VireMusic», Play/Pause, Следующий/Предыдущий трек, автозапуск, «Выход»),
  клик по «Выход» реально завершил процесс — пропал из `tasklist`.

`cargo tauri build` — оба бандла (`msi`/`nsis`) собираются без ошибок с этими
изменениями.

## Единственный экземпляр и память окна (срез 5)

Два официальных Tauri v2 плагина, `apps/desktop/src-tauri/src/main.rs`:

- **`tauri-plugin-single-instance`** — повторный запуск не создаёт второй процесс:
  плагин детектит уже запущенный экземпляр и убивает новый, передавая его argv/cwd
  колбэком в `AppHandle` первого процесса. Колбэк вызывает `show_and_focus` — ту же
  функцию, что показывает окно из пункта трея «Показать», левого клика по трею и
  хоткея `Ctrl+Alt+V` (срезы 1/4); вынесена один раз, а не скопирована в четвёртое
  место. Плагин зарегистрирован **первым** в цепочке `.plugin(...)` — задокументированное
  требование самого плагина (README: "make sure that this plugin is registered first").
- **`tauri-plugin-window-state`** — сохраняет размер/позицию/maximized/visible окна на
  диск (`%APPDATA%/ru.viremusic.desktop/.window-state.json`) при выходе (`RunEvent::Exit`)
  и восстанавливает автоматически через `on_window_ready` для любого окна вне
  зависимости от того, создано оно декларативно в конфиге или билдером в рантайме (как
  у нас в `setup()`) — ручной вызов `WindowExt::restore_state` не понадобился, плагин
  сам вешает слушатель при готовности окна. Подключён `.build()` без дополнительных
  настроек — дефолтные `StateFlags::all()` достаточны, кастомизации (`with_state_flags`,
  denylist) не потребовалось.
- Capabilities не менялись: оба плагина управляются целиком из Rust (single-instance —
  колбэком в `main.rs`, window-state — автоматически на события окна), JS-стороне
  `invoke()` их команды не нужны — тот же паттерн, что у трея/`global-shortcut`/autostart.

**Проверено эмпирически (16.08.2026, `cargo tauri build` + реальный `.exe` из
`target/release`, не `cargo tauri dev`):**
- Два запуска `.exe` подряд: `tasklist`/`Get-Process` показывают один процесс
  (`process count: 1`), foreground-окно — «VireMusic» (второй процесс не пережил
  собственный старт, был убит плагином до создания окна).
- То же при свёрнутом в трей первом окне: `WM_CLOSE` в окно (симулирует клик по
  крестику, срез 4) спрятало его (`IsWindowVisible` → `false`, процесс жив), повторный
  запуск `.exe` — снова один процесс, `IsWindowVisible` → `true`, окно в foreground.
- Геометрия: окно передвинуто/растянуто (`SetWindowPos`) до конкретных значений,
  подтверждённых `GetWindowRect`; полный выход — клик по пункту трея «Выход» через UI
  Automation (`System.Windows.Automation` + `mouse_event` по координатам меню, тот же
  подход, что подтвердил «Выход» в срезе 4), `tasklist` — процесс пропал. Повторный
  запуск — новый PID, `GetWindowRect` вернул **точно те же** координаты/размер, не
  дефолтные 1280×800 в дефолтной позиции ОС. `.window-state.json` содержит физические
  пиксели с учётом DPI-масштабирования системы — сравнение через одну и ту же
  измерительную обвязку (`GetWindowRect` из не-DPI-aware процесса) на входе и после
  рестарта совпало один в один.

## Сплэш-экран (срез 6)

Главное окно грузит `shell_url()` как внешний URL — на холодном старте это сетевой
запрос, и без сплэша пользователь несколько секунд видел пустое окно ОС. Решение
полностью нативное, без IPC/`eval`/JS со стороны веб-страницы:

- `apps/desktop/frontend-stub/splash.html` — маленький статический HTML (лого + CSS-
  спиннер, тёмный фон `oklch(0.085 0.006 75)` — значение платформенного `--background`
  из `packages/design-tokens/src/tokens.json`, скопировано напрямую, а не через пакет).
  Живёт в `frontend-stub/`, потому что это единственный каталог, который Tauri встраивает
  в бинарь как `frontendDist` (см. «Где код» выше) — грузится `WebviewUrl::App`, без
  сети. Не путать с `frontend-stub/index.html` — та заглушка по-прежнему никогда не
  рендерится (её грузит только несуществующий дефолтный webview из `tauri.conf.json`,
  реального окна с ней нет).
- `apps/desktop/src-tauri/src/main.rs`, `setup()`: сплэш-окно (`WebviewWindowBuilder`,
  лейбл `"splash"`, 220×220, без рамки, по центру, `always_on_top`, без иконки в
  таскбаре) создаётся первым, видно сразу. Главное окно строится как раньше, но с
  `.visible(false)`, и несёт `.on_page_load(...)`: по `PageLoadEvent::Finished` —
  `window.show()` + `set_focus()` + `splash.close()`. Событие идёт от вебвью напрямую
  в Rust — веб-страница ни при чём, IPC не открывается.
- **Взаимодействие с `tauri-plugin-window-state` (срез 5) — два эффекта, оба
  проверены эмпирически на собранном `.exe`, не по чтению кода:**
  1. Плагин слушает `on_window_ready` для любого окна — без ограничения сплэш попал
     бы в `.window-state.json`. Исправлено штатной возможностью плагина:
     `.with_denylist(&["splash"])`. Подтверждено — после серии холодных запусков
     (debug и release) в файле стабильно только ключ `"main"`, `"splash"` ни разу
     не появился.
  2. Более серьёзный найденный эффект: `on_window_ready` плагина безусловно вызывает
     `self.show()` на **любом** отслеживаемом окне, если трекается `StateFlags::VISIBLE`
     (см. исходник `tauri-plugin-window-state-2.4.1/src/lib.rs`, `restore_state`) —
     это происходит сразу после создания окна, задолго до реальной загрузки страницы,
     и свело бы на нет весь смысл сплэша (главное окно показывалось бы раньше времени
     при каждом запуске, где в кэше есть `visible: true`, — то есть почти всегда).
     Исправлено тем же путём: `.with_state_flags(StateFlags::SIZE | StateFlags::POSITION
     | StateFlags::MAXIMIZED)` — `VISIBLE` не трекается, видимостью управляет только
     наш `on_page_load`. Подтверждено таймингом окон (см. ниже): между созданием
     главного окна и его показом нет ложного раннего `show()`.

**Проверено эмпирически (16.08.2026), на собранном `cargo tauri build` `.exe`
(debug — со специально подставленным тестовым HTTP-сервером вместо `shell_url()` для
контролируемой задержки; release — на боевом `https://viremusic.ru`), тайминг снят
опросом `EnumWindows`/`IsWindowVisible`/`GetWindowRect` по PID процесса, не по логам:**

- **Сплэш появляется сразу.** Splash-окно (234×228 с рамкой ОС) видимо уже на первом
  же снимке после старта процесса (~150–900мс в разных прогонах — старт вебвью/рантайма
  Tauri, не сетевой запрос).
- **Закрытие идёт по реальной загрузке, не по таймеру — подтверждено пропорцией.**
  Тестовый сервер с искусственной задержкой 6с: сплэш держится ~7.2с (от появления
  до исчезновения), главное окно скрыто (`visible=False`) вплоть до показа. Тот же
  сервер с задержкой 50мс: сплэш держится ~1.1с. Длительность сплэша меняется
  пропорционально задержке сервера — жёсткий таймер дал бы одинаковую длительность
  независимо от неё. На реальном `https://viremusic.ru` (release-сборка) — сплэш
  держится ~2.1с, соответствует времени реальной загрузки страницы.
- **Единственный экземпляр (срез 5) не создаёт сплэш повторно.** Первый инстанс
  запущен и свёрнут в трей (`WM_CLOSE`, как крестик). Второй запуск `.exe` создал
  несколько невидимых служебных окон WebView2 (0×0/14×14) и сам процесс завершился
  через ~150мс (штатное поведение `tauri-plugin-single-instance`) — ни разу не
  появилось окно с размерами сплэша (100–400px) ни у одного из двух PID за время
  наблюдения. Окно первого инстанса стало видимым и получило фокус
  (`GetForegroundWindow` → PID первого процесса) в момент запуска второго —
  единственный оставшийся процесс после теста: 1.

## Скачивание и дистрибуция

Публичная сторона: страница `/download`, короткий баннер на сайте, и CI-пайплайн,
который после каждого тега `vX.Y.Z` собирает `.msi`/`.exe` и публикует его туда, куда
реально ведёт кнопка «Скачать».

- **`apps/web/lib/platform-detect.ts`** — чистая `detectPlatform(userAgent, maxTouchPoints?)`
  по эвристикам UA (Android раньше Linux — Android UA содержит "Linux"; iPadOS 13+ шлёт
  UA обычного Mac, отличается только по multi-touch).
- **`apps/web/lib/desktop-download.ts`** — `getWindowsDownloadUrl()` строит стабильный URL
  из `process.env.S3_PUBLIC_ENDPOINT` + бакета `STREAM` (`@/lib/s3`) тем же паттерном, что
  `S3ObjectStorage.upload()`: `${publicBaseUrl}/${bucket}/downloads/desktop/windows/VireMusic-Setup-x64.exe`.
  `null`, если `S3_PUBLIC_ENDPOINT` не задан.
- **`app/[locale]/(listener)/download/page.tsx`** — Server Component. Windows — рабочая
  кнопка на реальный URL выше; macOS/Linux/iOS/Android — честные карточки «скоро», без
  фейковых кнопок (мобильный клиент не в приоритете, `docs/multiplatform.md` §12 п.8);
  внизу — заметка про PWA как уже доступную сегодня альтернативу (`InstallAppButton`).
- **`apps/web/components/desktop-download-banner.tsx`** — клиентский баннер, показывается
  только посетителям с Windows (детекция на маунте), ведёт на `/download#windows`.
  Разовое закрытие — `localStorage` (`vire_desktop_banner_dismissed_v1`), тот же паттерн
  isSeen/markSeen, что у `CookieBanner`/`Announcements`. Смонтирован один раз в
  `DeferredWidgets` (`apps/web/components/deferred-widgets.tsx`), не на каждой странице.
- **`packages/i18n/messages/{ru,en}/download.json`** — строки страницы и баннера,
  неймспейс `download` в `packages/i18n/src/messages.ts`.

### Дистрибуция: GitHub Release + публичный MinIO

Репозиторий приватный — прямая ссылка на GitHub Release не откроется анонимному
посетителю сайта, поэтому CI публикует собранный инсталлятор в двух местах:

1. **GitHub Release** тега `vX.Y.Z` — версионированный файл (`VireMusic_x.y.z_x64-setup.exe`
   /`.msi`), доступен только тем, кто видит репозиторий.
2. **MinIO `vire-stream`** — тот же файл под стабильным (без версии) ключом
   `downloads/desktop/windows/VireMusic-Setup-x64.exe`, перезаписывается каждым релизом.
   Бакет уже отдаётся анонимно (`mc anonymous set download`, `docker-compose.yml`) — на
   этот URL и ссылается кнопка «Скачать» на `/download`
   (`${S3_PUBLIC_ENDPOINT}/vire-stream/downloads/desktop/windows/VireMusic-Setup-x64.exe`,
   в проде — `https://cdn.viremusic.ru/vire-stream/downloads/desktop/windows/...`).

Job `build-desktop` в `.github/workflows/deploy.yml` — `windows-latest`, `needs: gates`,
тот же триггер тегом, параллельно `build-and-push`/`deploy`. Сборка — `cargo install
tauri-cli` + `cargo tauri build` (не `tauri-apps/tauri-action`: проект без npm-скрипта
`tauri`, только Rust CLI, а сами артефакты и их пути уже подтверждены локально — см.
«Прод-сборка» выше; ручной путь предсказуемее для конфигурации, которую нельзя было
прогнать вживую в этом заходе). Публикация в Release — `softprops/action-gh-release`;
загрузка в MinIO — `aws s3 cp --endpoint-url` (CLI уже стоит на `windows-latest`).

**Нужны новые repo secrets (заводятся вручную, GitHub → Settings → Secrets → Actions;
значения — те же, что в `.env` на проде):**
- `S3_UPLOAD_ACCESS_KEY`, `S3_UPLOAD_SECRET_KEY` — доступ к MinIO на запись.
- `S3_UPLOAD_ENDPOINT` — MinIO endpoint, доступный из GitHub Actions (вероятно тот же
  `cdn.viremusic.ru`, раз Caddy проксирует туда порт 9000 — не проверено вживую).

Пока секретов нет, шаг загрузки в MinIO красный (`continue-on-error: true` — не валит
остальной job, GitHub Release публикуется как обычно) — ожидаемо до того, как секреты
заведут вручную.

## Где код

- `apps/desktop/src-tauri/Cargo.toml` — крейт `vire-desktop`, зависимости `tauri` `^2`
  (фича `tray-icon`), `tauri-plugin-global-shortcut` `^2`, `tauri-plugin-autostart` `^2`,
  `tauri-plugin-single-instance` `^2.4.3`, `tauri-plugin-window-state` `^2.4.1`,
  `tauri-build` `^2`.
- `apps/desktop/src-tauri/src/main.rs` — `shell_url()`, `show_and_focus()` (общая
  show+focus, срез 5), `WebviewWindowBuilder` с `WebviewUrl::External`, трей и
  глобальные медиа-шорткаты (срез 1), чекбокс автозапуска в трее (срез 3),
  close-to-tray обработчик и хоткей `Ctrl+Alt+V` (срез 4), single-instance колбэк и
  window-state плагин (срез 5), сплэш-окно + `on_page_load` на главном окне (срез 6).
- `apps/desktop/frontend-stub/splash.html` — контент сплэша (срез 6), см. выше.
- `apps/desktop/src-tauri/src/bridge.rs` — `call_bridge`, см. выше.
- `apps/web/lib/desktop-bridge.ts`, `apps/web/lib/player/media-session.ts`,
  `apps/web/components/player/index.tsx` — веб-мост и Media Session, см. выше.
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
- **Подпись «Play»/«Пауза» в кастомном меню трея по-прежнему статична** — SMTC (срез 2)
  показывает реальное состояние в системном виджете «Сейчас играет», но не умеет
  дотянуться до нашего Rust-`MenuItem` в трее (это не системный SMTC-элемент). Нужен
  отдельный канал веб→Rust (Tauri IPC-команда `report_playback_state` +
  точечный `dangerousRemoteDomainIpcAccess`) — сознательно отложено отдельным заходом:
  это первое место в проекте, где прод-домену открывается прямой IPC-канал в нативный
  код, решение с реальным весом, не принимается в потоке одного среза
  (`docs/superpowers/specs/2026-08-16-desktop-shell-slice-2-design.md`, раздел 2).
- Мини-плеер поверх других окон (отдельное окно/оверлей)
- Пользовательские настройки хоткеев (смена комбинации) — `Ctrl+Alt+V` (показать/
  скрыть окно, срез 4) и медиа-клавиши (срез 1) захардкожены
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
