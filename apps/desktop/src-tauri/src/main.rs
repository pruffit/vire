#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

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
    tauri::Builder::default()
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(shell_url().parse()?))
                .title("VireMusic")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .resizable(true)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
