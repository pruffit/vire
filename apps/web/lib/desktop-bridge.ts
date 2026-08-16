import { controls } from '@/lib/player/audio-engine';

declare global {
  interface Window {
    __vireDesktopBridge?: {
      togglePlay: () => void;
      next: () => void;
      prev: () => void;
    };
  }
}

// Мост для десктоп-оболочки (Tauri `WebviewWindow::eval`, см. docs/features/desktop-app.md).
// В браузере просто не используется — те же controls и так вызываются кликами по UI плеера.
window.__vireDesktopBridge = {
  togglePlay: () => controls.togglePlay(),
  next: () => controls.next(),
  prev: () => controls.prev(),
};
