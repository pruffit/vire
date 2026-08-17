#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod bridge;

use bridge::call_bridge;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_updater::UpdaterExt;
use tauri_plugin_window_state::StateFlags;

// Срез 0: оболочка грузит уже готовый веб-фронт по URL, нового UI нет.
// devUrl/frontendDist в tauri.conf.json намеренно не используются — URL решается
// здесь по cfg!(debug_assertions), это проще для dev/prod переключения, чем
// два статических конфига (см. design doc).
fn shell_url() -> &'static str {
    if cfg!(debug_assertions) {
        "http://localhost:3000"
    } else {
        "https://viremusic.ru"
    }
}

// Общий show+focus для трея, хоткея и single-instance колбэка — не дублировать по местам.
fn show_and_focus(window: &WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

// Общая для стартовой тихой проверки и пункта трея — не дублировать логику апдейтера
// по двум местам. `manual` управляет только тем, показывать ли диалог, когда обновлений
// нет/проверка не удалась — тихий старт не должен беспокоить пользователя сетевой ошибкой.
async fn check_for_updates(app: AppHandle, manual: bool) {
    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(err) => {
            if manual {
                app.dialog()
                    .message(format!("Не удалось проверить обновления: {err}"))
                    .kind(MessageDialogKind::Error)
                    .title("VireMusic")
                    .blocking_show();
            }
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let should_install = app
                .dialog()
                .message(format!(
                    "Доступна новая версия {}. Установить и перезапустить VireMusic?",
                    update.version
                ))
                .title("Обновление VireMusic")
                .buttons(MessageDialogButtons::YesNo)
                .blocking_show();

            if !should_install {
                return;
            }

            if let Err(err) = update.download_and_install(|_, _| {}, || {}).await {
                app.dialog()
                    .message(format!("Не удалось установить обновление: {err}"))
                    .kind(MessageDialogKind::Error)
                    .title("VireMusic")
                    .blocking_show();
                return;
            }

            app.restart();
        }
        Ok(None) => {
            if manual {
                app.dialog()
                    .message("У вас последняя версия VireMusic.")
                    .title("VireMusic")
                    .blocking_show();
            }
        }
        Err(err) => {
            if manual {
                app.dialog()
                    .message(format!("Не удалось проверить обновления: {err}"))
                    .kind(MessageDialogKind::Error)
                    .title("VireMusic")
                    .blocking_show();
            }
        }
    }
}

fn main() {
    let play_pause = Shortcut::new(None, Code::MediaPlayPause);
    let media_next = Shortcut::new(None, Code::MediaTrackNext);
    let media_prev = Shortcut::new(None, Code::MediaTrackPrevious);
    // Ctrl+Alt+V: verified empirically (cargo tauri dev) not to conflict with
    // Windows/Chrome/VS Code bindings on this machine — registers and toggles cleanly.
    let toggle_window = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyV);

    tauri::Builder::default()
        // Плагин требует регистрации первым в цепочке builder'а (см. его README).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                show_and_focus(&window);
            }
        }))
        // VISIBLE отключён: иначе плагин сам вызывает show() на "main" в on_window_ready
        // (сразу после создания окна, до загрузки страницы) по кэшированному состоянию —
        // это гонка со сплэшем, который должен закрыть окно только по on_page_load.
        // "splash" — в денилисте, чтобы короткоживущее окно не засоряло window-state.json.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .with_denylist(&["splash"])
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([play_pause, media_next, media_prev, toggle_window])
                .expect("shortcut strings are valid")
                .with_handler(move |app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let Some(window) = app.get_webview_window("main") else { return };
                    if shortcut == &play_pause {
                        call_bridge(&window, "togglePlay");
                    } else if shortcut == &media_next {
                        call_bridge(&window, "next");
                    } else if shortcut == &media_prev {
                        call_bridge(&window, "prev");
                    } else if shortcut == &toggle_window {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            show_and_focus(&window);
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let splash = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash.html".into()))
                .title("VireMusic")
                .inner_size(220.0, 220.0)
                .resizable(false)
                .decorations(false)
                .center()
                .always_on_top(true)
                .skip_taskbar(true)
                .build()?;

            let updater_handle = app.handle().clone();
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(shell_url().parse()?))
                .title("VireMusic")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .resizable(true)
                .visible(false)
                .initialization_script("window.__VIRE_DESKTOP__ = true;")
                .on_page_load(move |window, payload| {
                    if payload.event() == PageLoadEvent::Finished {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = splash.close();
                        // Тихая проверка при старте — только после того, как главное окно
                        // уже показано, чтобы не задерживать сплэш сетевым запросом.
                        let handle = updater_handle.clone();
                        tauri::async_runtime::spawn(check_for_updates(handle, false));
                    }
                })
                .build()?;

            // Крестик прячет в трей вместо закрытия — полный выход только через
            // пункт трея «Выход» (app.exit(0) ниже).
            let close_target = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = close_target.hide();
                }
            });

            let show = MenuItem::with_id(app, "show", "Показать VireMusic", true, None::<&str>)?;
            let play_pause = MenuItem::with_id(app, "play_pause", "Play/Pause", true, None::<&str>)?;
            let next = MenuItem::with_id(app, "next", "Следующий трек", true, None::<&str>)?;
            let prev = MenuItem::with_id(app, "prev", "Предыдущий трек", true, None::<&str>)?;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let autostart = CheckMenuItem::with_id(
                app,
                "autostart",
                "Запускать при входе в систему",
                true,
                autostart_enabled,
                None::<&str>,
            )?;
            let check_updates =
                MenuItem::with_id(app, "check_updates", "Проверить обновления", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &show,
                    &PredefinedMenuItem::separator(app)?,
                    &play_pause,
                    &next,
                    &prev,
                    &PredefinedMenuItem::separator(app)?,
                    &autostart,
                    &check_updates,
                    &PredefinedMenuItem::separator(app)?,
                    &quit,
                ],
            )?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    let Some(window) = app.get_webview_window("main") else { return };
                    match event.id.as_ref() {
                        "show" => show_and_focus(&window),
                        "play_pause" => call_bridge(&window, "togglePlay"),
                        "next" => call_bridge(&window, "next"),
                        "prev" => call_bridge(&window, "prev"),
                        "autostart" => {
                            let manager = app.autolaunch();
                            let currently_enabled = manager.is_enabled().unwrap_or(false);
                            let toggled = if currently_enabled {
                                manager.disable()
                            } else {
                                manager.enable()
                            };
                            if toggled.is_ok() {
                                let _ = autostart.set_checked(!currently_enabled);
                            }
                        }
                        "check_updates" => {
                            let handle = app.clone();
                            tauri::async_runtime::spawn(check_for_updates(handle, true));
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            show_and_focus(&window);
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
