use tauri::WebviewWindow;

/// Единственный путь команд плеера в веб-страницу: `eval`, не Tauri IPC (см. design doc,
/// причина — окно грузит внешний origin, IPC туда сознательно не открываем).
pub fn call_bridge(window: &WebviewWindow, method: &str) {
    let js = format!("window.__vireDesktopBridge && window.__vireDesktopBridge.{method}()");
    let _ = window.eval(&js);
}
