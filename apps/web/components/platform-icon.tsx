import type { PlatformKey } from '@/lib/platforms';

// Оригинальные монохромные глифы площадок (не копии брендовых лого), currentColor.

interface Props {
  platform: PlatformKey;
  size?: number;
  className?: string;
}

export function PlatformIcon({ platform, size = 20, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    className,
  };

  switch (platform) {
    case 'spotify': // волны в круге
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M7.5 9.5c3-1 6-1 9 .6M8 12.4c2.4-.8 4.8-.7 7 .5M8.5 15c1.9-.6 3.8-.5 5.6.4" />
        </svg>
      );
    case 'apple_music': // восьмая нота
      return (
        <svg {...common} fill="currentColor">
          <path d="M9 5l9-1.6v11.3a3 3 0 1 1-1.8-2.75V6.2L10.8 7.1v9.1A3 3 0 1 1 9 13.45z" />
        </svg>
      );
    case 'youtube': // плей в скруглённом прямоугольнике
      return (
        <svg {...common} fill="currentColor">
          <path d="M3 8.2c0-1.7 1-3 2.7-3.2C7.8 4.8 9.9 4.7 12 4.7s4.2.1 6.3.3C20 5.2 21 6.5 21 8.2v7.6c0 1.7-1 3-2.7 3.2-2.1.2-4.2.3-6.3.3s-4.2-.1-6.3-.3C4 18.8 3 17.5 3 15.8z" />
          <path d="M10 9l5 3-5 3z" fill="#000" />
        </svg>
      );
    case 'youtube_music': // плей в круге
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'yandex_music': // нота в круге
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M14.5 7.5v6.2a2 2 0 1 1-1.3-1.87V9.2l-3.7.8v4.4a2 2 0 1 1-1.3-1.87V9z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'vk_music':
    case 'vk': // монограмма VK
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
          <path d="M6.5 8.5c.6 3.5 2.6 6 5.5 6h1v-2.2l2 2.2h2c-1-1.6-2.2-2.7-2.2-2.7s1.4-1.4 2-3.3h-1.8c-.5 1.4-1.6 2.6-2 2.6V8.5h-2v3.2c-1-.6-1.8-2-2.2-3.2z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'zvuk': // эквалайзер
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 10v4M9 7v10M13 9v6M17 6v12M21 11v2" />
        </svg>
      );
    case 'soundcloud': // облако с барами
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 16v-3M7 16v-5M10 16v-7" />
          <path d="M13 16V9a4 4 0 0 1 7.5-1.9A3 3 0 0 1 20 16z" />
        </svg>
      );
    case 'bandcamp': // фирменный параллелограмм
      return (
        <svg {...common} fill="currentColor">
          <path d="M3 16.5L8 7.5h13l-5 9z" />
        </svg>
      );
    case 'telegram': // бумажный самолётик
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.5 4.3L2.9 11.4c-.9.3-.9 1.6 0 1.9l4.6 1.5 1.8 5.5c.3.8 1.3 1 1.9.3l2.5-2.7 4.6 3.4c.7.5 1.7.1 1.9-.7l3-15c.2-1-.8-1.9-1.7-1.3zM9.6 14.3l8.2-5.6-6.8 6.2-.2 3.2z" />
        </svg>
      );
    case 'instagram': // камера
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'tiktok': // нота со сдвигом
      return (
        <svg {...common} fill="currentColor">
          <path d="M14 3c.4 2.4 1.9 4 4.4 4.3v2.6c-1.6 0-3.1-.5-4.4-1.4v5.9a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.7a2.9 2.9 0 1 0 2 2.8V3z" />
        </svg>
      );
    case 'x': // икс
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      );
    case 'website':
    default: // глобус
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5z" />
        </svg>
      );
  }
}
