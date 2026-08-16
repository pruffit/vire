#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;

use bridge::call_bridge;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

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
        .plugin(tauri_plugin_window_state::Builder::default().build())
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
        .setup(|app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(shell_url().parse()?))
                .title("VireMusic")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .resizable(true)
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
