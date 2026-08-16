#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;

use bridge::call_bridge;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, Shortcut, ShortcutState};

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

fn main() {
    let play_pause = Shortcut::new(None, Code::MediaPlayPause);
    let media_next = Shortcut::new(None, Code::MediaTrackNext);
    let media_prev = Shortcut::new(None, Code::MediaTrackPrevious);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([play_pause, media_next, media_prev])
                .expect("media key shortcut strings are valid")
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
                    }
                })
                .build(),
        )
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(shell_url().parse()?))
                .title("VireMusic")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .resizable(true)
                .build()?;

            let show = MenuItem::with_id(app, "show", "Показать VireMusic", true, None::<&str>)?;
            let play_pause = MenuItem::with_id(app, "play_pause", "Play/Pause", true, None::<&str>)?;
            let next = MenuItem::with_id(app, "next", "Следующий трек", true, None::<&str>)?;
            let prev = MenuItem::with_id(app, "prev", "Предыдущий трек", true, None::<&str>)?;
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
                    &quit,
                ],
            )?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| {
                    let Some(window) = app.get_webview_window("main") else { return };
                    match event.id.as_ref() {
                        "show" => {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        "play_pause" => call_bridge(&window, "togglePlay"),
                        "next" => call_bridge(&window, "next"),
                        "prev" => call_bridge(&window, "prev"),
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
