/**
 * Белый список хостов обложек внешних треков. Синхронизирован с `img-src` и
 * `images.remotePatterns` в `next.config.ts`: `next/image` падает на ненастроенном хосте,
 * а `og:image` произвольной страницы может вести куда угодно. Чужой хост → обложки нет,
 * рисуется нейтральный плейсхолдер.
 */
const ALLOWED = [
  'ytimg.com',
  'sndcdn.com',
  'mzstatic.com',
  'scdn.co',
  'dzcdn.net',
  'userapi.com',
  'mycdn.me',
  'avatars.yandex.net',
];

export function sanitizeCoverUrl(url: string | null): string | null {
  if (!url) return null;
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    host = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
  return ALLOWED.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? url : null;
}
