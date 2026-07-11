// Распознавание площадки/соцсети по URL — чистая функция. Иконку рисует
// components/platform-icon.tsx; нераспознанное → 'website', имя из подписи/хоста.

export type PlatformKey =
  | 'spotify'
  | 'apple_music'
  | 'youtube_music'
  | 'youtube'
  | 'yandex_music'
  | 'vk_music'
  | 'vk'
  | 'zvuk'
  | 'soundcloud'
  | 'bandcamp'
  | 'deezer'
  | 'tidal'
  | 'amazon_music'
  | 'bandlab'
  | 'telegram'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'facebook'
  | 'bluesky'
  | 'discord'
  | 'twitch'
  | 'bandsintown'
  | 'website';

export const PLATFORM_NAMES: Record<PlatformKey, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube_music: 'YouTube Music',
  youtube: 'YouTube',
  yandex_music: 'Яндекс Музыка',
  vk_music: 'VK Музыка',
  vk: 'VK',
  zvuk: 'Звук',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  deezer: 'Deezer',
  tidal: 'TIDAL',
  amazon_music: 'Amazon Music',
  bandlab: 'BandLab',
  telegram: 'Telegram',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  facebook: 'Facebook',
  bluesky: 'Bluesky',
  discord: 'Discord',
  twitch: 'Twitch',
  bandsintown: 'Bandsintown',
  website: 'Сайт',
};

export interface DetectedPlatform {
  key: PlatformKey;
  /** Название по умолчанию (подпись пользователя имеет приоритет). */
  name: string;
}

/** Распознаёт площадку по URL. Невалидный/неизвестный → website. */
export function detectPlatform(url: string): DetectedPlatform {
  let host: string;
  let path: string;
  try {
    const u = new URL(url.trim());
    host = u.hostname.toLowerCase().replace(/^www\./, '');
    path = u.pathname.toLowerCase();
  } catch {
    return { key: 'website', name: PLATFORM_NAMES.website };
  }

  const is = (...domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));
  const key = ((): PlatformKey => {
    if (is('spotify.com', 'spotify.link')) return 'spotify';
    if (is('music.apple.com') || host === 'apple.co' || is('itunes.apple.com')) return 'apple_music';
    if (host === 'music.youtube.com') return 'youtube_music';
    if (is('youtube.com') || host === 'youtu.be') return 'youtube';
    if (host.startsWith('music.yandex')) return 'yandex_music';
    // VK Музыка: /artist/ с завершающим слэшем (не ловит /artistpage), /music*,
    // /audio*, либо домен vkmusic.ru; иначе vk.com — обычный профиль.
    if (
      is('vk.com', 'vkmusic.ru') &&
      (path === '/artist' || path.startsWith('/artist/') || path.startsWith('/music') || path.startsWith('/audio') || host === 'vkmusic.ru')
    ) return 'vk_music';
    if (is('vk.com', 'vk.ru')) return 'vk';
    if (is('zvuk.com', 'sber-zvuk.com')) return 'zvuk';
    if (is('soundcloud.com')) return 'soundcloud';
    if (is('bandcamp.com')) return 'bandcamp';
    if (is('deezer.com', 'deezer.page.link', 'dzr.fm')) return 'deezer';
    if (is('tidal.com')) return 'tidal';
    if (host.startsWith('music.amazon.') || is('amazon.com', 'amazon.de', 'amazon.co.uk') && path.startsWith('/music')) return 'amazon_music';
    if (is('bandlab.com')) return 'bandlab';
    if (host === 't.me' || is('telegram.me', 'telegram.org')) return 'telegram';
    if (is('instagram.com')) return 'instagram';
    if (is('tiktok.com')) return 'tiktok';
    if (is('x.com', 'twitter.com')) return 'x';
    if (is('facebook.com', 'fb.com', 'fb.me')) return 'facebook';
    if (is('bsky.app')) return 'bluesky';
    if (is('discord.gg', 'discord.com', 'discordapp.com')) return 'discord';
    if (is('twitch.tv')) return 'twitch';
    if (is('bandsintown.com')) return 'bandsintown';
    return 'website';
  })();

  // Для неизвестного хоста используем сам хост как осмысленное имя.
  const name = key === 'website' ? host : PLATFORM_NAMES[key];
  return { key, name };
}

/** Итоговая подпись ссылки: пользовательская подпись приоритетнее распознанной. */
export function linkLabel(url: string, label?: string | null): string {
  if (label && label.trim()) return label.trim();
  return detectPlatform(url).name;
}
