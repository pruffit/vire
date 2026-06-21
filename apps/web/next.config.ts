import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const { version } = _require('./package.json') as { version: string };

// Корень монорепо — чтобы standalone-трейсинг собрал воркспейс-пакеты
// (@vire/core, @vire/db, @vire/ui), а не только apps/web.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

// Обложки и аватары лежат в S3/MinIO и отдаются по S3_PUBLIC_ENDPOINT
// (локально http://localhost:9000, на проде — Selectel). next/image должен
// знать этот хост, иначе оптимизатор откажется их грузить.
function s3RemotePattern() {
  try {
    const u = new URL(process.env.S3_PUBLIC_ENDPOINT ?? 'http://localhost:9000');
    return {
      protocol: u.protocol.replace(':', '') as 'http' | 'https',
      hostname: u.hostname,
      port: u.port || undefined,
      pathname: '/**',
    };
  } catch {
    return { protocol: 'http' as const, hostname: 'localhost', port: '9000', pathname: '/**' };
  }
}

function s3Origin(): string {
  try {
    return new URL(process.env.S3_PUBLIC_ENDPOINT ?? 'http://localhost:9000').origin;
  } catch {
    return 'http://localhost:9000';
  }
}

// Origin приёмника ошибок (Sentry/GlitchTip) — берём из самого DSN, чтобы CSP
// автоматически пропускал куда реально шлёт клиент (self-hosted GlitchTip имеет
// свой хост, а не *.ingest.sentry.io). Пусто/невалидно → ничего не добавляем.
function sentryOrigin(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

function buildCsp(): string {
  const s3 = s3Origin();
  const sentry = sentryOrigin();
  const dev = process.env.NODE_ENV !== 'production';
  const parts = [
    `default-src 'self'`,
    // telegram.org нужен для виджета входа; mc.yandex.ru — Метрика (если задан NEXT_PUBLIC_METRIKA_ID).
    // youtube.com/s.ytimg.com — IFrame Player API; vk.com — VK Video Player API (videoplayer.js).
    // 'unsafe-eval' только в dev (webpack source maps); prod-сборка не использует eval.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://telegram.org https://mc.yandex.ru https://mc.yandex.com https://www.youtube.com https://s.ytimg.com https://vk.com`,
    `style-src 'self' 'unsafe-inline'`,
    // аватары: Yandex, Google (lh3), Telegram (t.me); mc.yandex.ru/.com — Метрика (пиксели, gif, синк);
    // ytimg — постеры YouTube-фасадов; userapi/mycdn — постеры VK-видео (video.get).
    `img-src 'self' data: blob: https://avatars.yandex.net https://lh3.googleusercontent.com https://t.me https://mc.yandex.ru https://mc.yandex.com https://i.ytimg.com https://*.ytimg.com https://*.userapi.com https://*.mycdn.me ${s3}`,
    `media-src 'self' blob: ${s3}`,
    // Клиентский Sentry/GlitchTip шлёт ошибки на origin своего DSN (sentryOrigin).
    // DSN-gated: без NEXT_PUBLIC_SENTRY_DSN запись не добавляется и запросов нет.
    `connect-src 'self' blob: ${s3} https://mc.yandex.ru https://mc.yandex.com wss://mc.yandex.com${sentry ? ` ${sentry}` : ''}${dev ? ' ws://localhost:* wss://localhost:*' : ''}`,
    `font-src 'self' data:`,
    `worker-src blob:`,
    // oauth.telegram.org — iframe виджета Telegram Login; youtube.com/vk.com/vkvideo.ru — встраиваемые плееры видео
    `frame-src https://oauth.telegram.org https://www.youtube.com https://www.youtube-nocookie.com https://vk.com https://vkvideo.ru`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    ...(!dev ? [`upgrade-insecure-requests`] : []),
  ];
  return parts.join('; ');
}

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'accelerometer=()',
      'gyroscope=()',
      'magnetometer=()',
      'display-capture=()',
      'interest-cohort=()',
    ].join(', '),
  },
  // same-origin-allow-popups: изолируем от cross-origin opener'ов (Spectre),
  // но разрешаем OAuth-попапы (Google, Yandex, Telegram) открывать нас обратно.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Content-Security-Policy', value: buildCsp() },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSION: version,
  },
  // Самодостаточный бандл (server.js + только нужные node_modules) для Docker.
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  transpilePackages: ['@vire/core', '@vire/db', '@vire/ui'],
  images: {
    // AVIF даёт ~50% экономии vs JPEG при том же качестве; WebP — fallback.
    formats: ['image/avif', 'image/webp'],
    // Только нужные брейкпоинты — меньше вариантов кешируется на сервере.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [24, 36, 48, 64, 96, 128, 180, 256, 320],
    // Холодная AVIF-кодировка крупной обложки на слабом VPS = ~2–3с и бьёт
    // прямо в LCP (PSI ловил 9с сразу после деплоя). Держим оптимизированные
    // варианты в кэше сутки вместо дефолтных 4ч — меньше повторных кодирований.
    // Дольше не ставим: ключ обложки стабилен (covers/{releaseId}) — при замене
    // URL тот же, нужен разумный запас на инвалидацию. Сам кэш переживает
    // деплой через том web_image_cache (docker-compose.prod.yml).
    minimumCacheTTL: 86400,
    remotePatterns: [
      s3RemotePattern(),
      { protocol: 'https', hostname: 'avatars.yandex.net', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 't.me', pathname: '/**' },
    ],
    // Next 16 блокирует оптимизацию картинок с приватных/loopback IP (SSRF-защита).
    // Локально MinIO живёт на localhost → разрешаем только в dev. На проде хранилище
    // (Selectel) публичное, поэтому флаг не нужен и остаётся выключенным.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
  experimental: {
    // proxy.ts (Auth.js) заставляет Next 16 буферизовать тело запроса. Лимит по
    // умолчанию — 10MB: WAV-мастер крупнее обрезается, multipart-граница рвётся,
    // и req.formData() падает с "Invalid multipart form data". Поднимаем под
    // размер аудио-мастеров (WAV ~10–17MB/мин).
    proxyClientMaxBodySize: '300mb',
  },
};

export default nextConfig;
