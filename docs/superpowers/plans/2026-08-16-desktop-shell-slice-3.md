# План — десктоп-клиент, срез 3 (автозапуск)

Спека: `docs/superpowers/specs/2026-08-16-desktop-shell-slice-3-design.md`.
Продолжает срезы 0-2 (уже в `main`).

## Шаги

1. **Зависимость**: `cargo add tauri-plugin-autostart` в `apps/desktop/src-tauri/Cargo.toml`.
2. **Регистрация плагина** в `main.rs`: `tauri_plugin_autostart::init(MacosLauncher::LaunchAgent,
   None)` (аргумент автозапуска команды — `None`, приложение и так открывает окно на старте,
   доп. флаги не нужны; свериться с актуальной сигнатурой плагина v2 по факту, не по памяти).
3. **Пункт меню**: заменить обычный `MenuItem`/добавить рядом `CheckMenuItem` «Запускать при
   входе в систему» в существующее построение трей-меню (там же, где show/play-pause/next/
   prev/quit из среза 1). Начальное состояние чекбокса — из `app.autolaunch().is_enabled()`
   (метод плагина, имя свериться по факту). Обработчик в `on_menu_event` — toggle
   `enable()`/`disable()` через `app.autolaunch()`, затем обновить `checked` пункта меню
   (`CheckMenuItem::set_checked`).
4. **Capabilities**: если плагин требует permission в `apps/desktop/src-tauri/capabilities/
   default.json` — добавить (проверить эмпирически, не гадать).

## Проверка

`cargo tauri dev` — включить чекбокс, подтвердить реальную запись в Windows-автозагрузке
(`reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run` или Task Manager →
«Автозагрузка»), выключить — подтвердить исчезновение записи. `cargo tauri build` —
сборка с новым плагином не ломается.

## Документация

Дополнить `docs/features/desktop-app.md` (существующий файл) — секция про автозапуск,
обновить список ограничений (убрать «автозапуск» из несделанного, если он там
перечислен явно).

## Делегирование

Один сабагент (Sonnet), фон. Самокритика не нужна — фича либо реально ставит/снимает
запись автозагрузки при проверке, либо нет, критерий уже в плане.
