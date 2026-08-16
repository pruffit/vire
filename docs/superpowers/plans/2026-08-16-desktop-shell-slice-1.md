# План — десктоп-клиент, срез 1 (трей + медиа-клавиши)

Спека: `docs/superpowers/specs/2026-08-16-desktop-shell-slice-1-design.md`.
Продолжает срез 0 (`docs/superpowers/plans/2026-08-16-desktop-shell-slice-0.md`, уже в `main`).

## Шаги

1. **Веб-мост**: `apps/web/lib/desktop-bridge.ts` — чистый модуль, импортирует `controls`
   из `apps/web/lib/player/audio-engine.ts`, на импорте выставляет
   `window.__vireDesktopBridge = { togglePlay: () => controls.togglePlay(), next: () =>
   controls.next(), prev: () => controls.prev() }` (обернуть стрелочными функциями, не
   передавать методы напрямую — сохранить `this`/на случай будущих сигнатур). Заимпортировать
   этот модуль из того места, где уже инициализируется плеер на клиенте (найти существующую
   точку — вероятно рядом с монтированием `usePlayerStore`/провайдера плеера в layout/корневом
   клиентском компоненте; сделать side-effect импортом `import '@/lib/desktop-bridge'`).
   Типы: `declare global { interface Window { __vireDesktopBridge?: {...} } }` в этом же файле.
2. **`tauri-plugin-global-shortcut`**: добавить зависимость в `apps/desktop/src-tauri/Cargo.toml`
   (`cargo add tauri-plugin-global-shortcut`), зарегистрировать в `main.rs`
   (`.plugin(tauri_plugin_global_shortcut::Builder::new().build())`), запросить у плагина
   регистрацию Play/Pause/Next/Previous — свериться с актуальным API плагина (может быть
   `Shortcut::from_str("MediaPlayPause")` или отдельный enum/константы для медиа-клавиш,
   документация плагина/примеры в его репозитории — проверить эмпирически, не гадать по памяти).
   Обработчик на каждое событие — `eval` соответствующей команды моста (шаг 3).
3. **Трей**: Tauri v2 `tauri::tray::TrayIconBuilder` в `main.rs` — иконка (переиспользовать
   существующие из `apps/desktop/src-tauri/icons/`), `Menu`/`MenuItem` («Показать VireMusic»,
   separator, «Play/Pause», «Следующий трек», «Предыдущий трек», separator, «Выход»),
   обработчик `on_menu_event`: «Показать» → `window.show()` + `window.set_focus()`; команды
   плеера → `eval` через сохранённый `WebviewWindow` handle (тот же, что создан в срезе 0,
   получить по `app.get_webview_window("main")`); «Выход» → `app.exit(0)`.
4. **`eval`-хелпер**: маленькая функция в `main.rs` (или отдельном `src/bridge.rs`, если
   main.rs разрастётся) — `fn call_bridge(window: &WebviewWindow, method: &str)`, формирует
   JS-строку `format!("window.__vireDesktopBridge && window.__vireDesktopBridge.{}()", method)`,
   вызывает `window.eval(...)`. Один хелпер и для трея, и для медиа-клавиш — не дублировать.
5. **Capabilities**: проверить `apps/desktop/src-tauri/capabilities/default.json` — нужны ли
   новые permissions для `global-shortcut` и `tray` плагинов (Tauri v2 плагины часто требуют
   явного разрешения в capabilities); если сборка падает на permission denied — добавить.

## Проверка

- `pnpm --filter @vire/web typecheck && lint && test` (новый файл `desktop-bridge.ts` — часть
  веб-кода, гейты веба применяются).
- `cargo tauri dev` (веб-дев-сервер поднят): открыть окно, запустить трек через обычный UI,
  затем кликнуть «Play/Pause»/«Следующий»/«Предыдущий» из трея — подтвердить, что реально
  меняется состояние плеера в открытом окне (не только что команда ушла без ошибки).
  Медиа-клавиши — нажать физические (если есть на клавиатуре) или программно эмулировать,
  задокументировать результат как есть.
- `cargo tauri build` — пересобрать инсталлятор, подтвердить, что новые плагины не ломают сборку.

## Документация

Дополнить `docs/features/desktop-app.md` (не новый файл — тот же, что для среза 0): что
добавилось (трей, медиа-клавиши, мост `eval`), обновить список «Ограничения» (убрать
трей/медиа-клавиши из списка несделанного среза 0, добавить актуальные ограничения среза 1:
нет синка состояния, нет мини-плеера, нет автозапуска).

## Делегирование

Один сабагент (Sonnet), фон — сборка Tauri снова не мгновенная, но toolchain уже стоит на
машине (срез 0), должно быть быстрее. Самокритика отдельным прогоном не нужна — тот же
принцип, что в срезе 0: либо трей/медиа-клавиши реально работают в `cargo tauri dev`
(проверяется в моменте), либо нет, фиктивной проверки тут не поставить.
