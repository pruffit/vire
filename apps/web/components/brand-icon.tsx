// Бренд-логотипы соцсетей и стримингов (цветные, как у площадки).
// Файлы: public/icons/brands/<name>.svg. Перегенерация: node scripts/build-icons.mjs.
// В отличие от Icon (монохром, currentColor через спрайт), бренд-логотипы
// рендерятся тегом картинки по файлу — у них свои цвета/градиенты, перекрашивать нельзя.
import type { CSSProperties } from 'react';
import type { PlatformKey } from '@/lib/platforms';
import { SOCIAL_ICON_NAMES, STREAMING_ICON_NAMES, BRAND_RATIO } from './icon-manifest.generated';

export type SocialIconName = (typeof SOCIAL_ICON_NAMES)[number];
export type StreamingIconName = (typeof STREAMING_ICON_NAMES)[number];
export type BrandName = SocialIconName | StreamingIconName;

/**
 * Площадка смартлинка (`detectPlatform`) → бренд-лого. `null` — лого нет
 * (`website`), рисуем монохромный глиф `PlatformIcon`.
 */
export const PLATFORM_BRAND: Record<PlatformKey, BrandName | null> = {
  spotify: 'spotify',
  apple_music: 'apple-music',
  youtube_music: 'youtube-music',
  youtube: 'youtube',
  yandex_music: 'yandex-music',
  vk_music: 'vk-music',
  vk: 'vk',
  zvuk: 'zvuk',
  soundcloud: 'soundcloud',
  bandcamp: 'bandcamp',
  deezer: 'deezer',
  tidal: 'tidal',
  amazon_music: 'amazon-music',
  bandlab: 'bandlab',
  telegram: 'telegram',
  instagram: 'instagram',
  tiktok: 'tiktok',
  x: 'x',
  facebook: 'facebook',
  bluesky: 'bluesky',
  discord: 'discord',
  twitch: 'twitch',
  bandsintown: 'bandsintown',
  website: null,
};

/** Лого-вордмарк (содержит название бренда) — рядом не нужна текстовая подпись. */
export function isBrandWordmark(name: BrandName): boolean {
  return (BRAND_RATIO[name] ?? 1) > 2.2;
}

/** Человекочитаемые названия — для alt/подписей. */
export const BRAND_LABELS: Record<BrandName, string> = {
  // social
  telegram: 'Telegram',
  discord: 'Discord',
  vk: 'VK',
  instagram: 'Instagram',
  x: 'X',
  facebook: 'Facebook',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  bandlab: 'BandLab',
  bandsintown: 'Bandsintown',
  tiktok: 'TikTok',
  twitch: 'Twitch',
  // streaming
  spotify: 'Spotify',
  'apple-music': 'Apple Music',
  'youtube-music': 'YouTube Music',
  'yandex-music': 'Яндекс Музыка',
  'vk-music': 'VK Музыка',
  'kion-music': 'КИОН Музыка',
  zvuk: 'Звук',
  deezer: 'Deezer',
  tidal: 'TIDAL',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  'amazon-music': 'Amazon Music',
};

export const SOCIAL_BRANDS = SOCIAL_ICON_NAMES;
export const STREAMING_BRANDS = STREAMING_ICON_NAMES;

/**
 * Бренд-логотип фиксированной высоты — ширина подстраивается под пропорции
 * (квадратные глифы и широкие вордмарки рендерятся одинаково корректно).
 * Декоративный по умолчанию (alt=''): подпись делает родитель. Передай `label`,
 * если иконка стоит без текста и должна озвучиваться скринридером.
 */
export function BrandIcon({
  name,
  size = 24,
  label,
  className,
  style,
}: {
  name: BrandName;
  /** Высота в px. Ширина — auto по viewBox. `null` — высоту задаёт className (адаптив). */
  size?: number | null;
  /** alt: '' (декор) если не задан; иначе название бренда. */
  label?: boolean | string;
  className?: string;
  style?: CSSProperties;
}) {
  const alt = label === true ? BRAND_LABELS[name] : typeof label === 'string' ? label : '';
  const src = `/icons/brands/${name}.svg`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- статичный бренд-SVG, не нужен next/image
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ height: size ?? undefined, width: 'auto', ...style }}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
