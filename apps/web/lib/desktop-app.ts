declare global {
  interface Window {
    __VIRE_DESKTOP__?: boolean;
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && window.__VIRE_DESKTOP__ === true;
}
