export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';

// Порядок проверок важен: Android UA содержит "Linux", а iPadOS 13+ шлёт UA
// обычного Mac — отличить можно только по multi-touch (maxTouchPoints > 1).
export function detectPlatform(userAgent: string, maxTouchPoints = 0): DesktopPlatform {
  const ua = userAgent.toLowerCase();

  if (/iphone|ipod/.test(ua)) return 'ios';
  if (/ipad/.test(ua) || (/macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows/.test(ua)) return 'windows';
  if (/mac os|macintosh/.test(ua)) return 'macos';
  if (/linux/.test(ua)) return 'linux';
  return 'unknown';
}
