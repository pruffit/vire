import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const { version } = _require('./package.json') as { version: string };

// Корень монорепо — чтобы standalone-трейсинг собрал воркспейс-пакеты
// (@vire/core, @vire/db, @vire/ui), а не только apps/web.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

// Хост S3_PUBLIC_ENDPOINT для next/image — иначе оптимизатор откажется грузить обложки/аватары.
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

function buildCsp(): string {
  const s3 = s3Origin();
  const dev = process.env.NODE_ENV !== 'production';
  const parts = [
    `default-src 'self'`,
    // telegram.org — виджет входа; mc.yandex — Метрика; youtube/ytimg и vk.com — плеерные API.
    // 'unsafe-eval' только в dev (webpack source maps); 'wasm-unsafe-eval' — Метрика
    // компилирует WebAssembly, без него tag.js падает с CompileError на каждой странице.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''} https://telegram.org https://mc.yandex.ru https://mc.yandex.com https://www.youtube.com https://s.ytimg.com https://vk.com https://w.soundcloud.com`,
    `style-src 'self' 'unsafe-inline'`,
    // аватары OAuth (yandex/lh3/t.me), Метрика, постеры YouTube (ytimg) и VK (userapi/mycdn);
    // обложки внешних треков вечеринки (см. lib/external/cover-hosts.ts — тот же список).
    `img-src 'self' data: blob: https://avatars.yandex.net https://lh3.googleusercontent.com https://t.me https://mc.yandex.ru https://mc.yandex.com https://i.ytimg.com https://*.ytimg.com https://*.userapi.com https://*.mycdn.me https://*.sndcdn.com https://*.mzstatic.com https://i.scdn.co https://*.scdn.co https://*.dzcdn.net ${s3}`,
    `media-src 'self' blob: ${s3}`,
    `connect-src 'self' blob: ${s3} https://mc.yandex.ru https://mc.yandex.com wss://mc.yandex.com${dev ? ' ws://localhost:* wss://localhost:*' : ''}`,
    `font-src 'self' data:`,
    `worker-src blob:`,
    // iframe виджета Telegram Login + встраиваемые видеоплееры
    `frame-src https://oauth.telegram.org https://www.youtube.com https://www.youtube-nocookie.com https://vk.com https://vkvideo.ru https://w.soundcloud.com`,
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
  // same-origin-allow-popups: изоляция от cross-origin opener'ов, но OAuth-попапы могут открывать нас обратно.
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
  // Трейсер не тащит libvips: sharp грузит его через dlopen по RPATH из соседней папки
  // внутри @img, а не require'ом. Без этого в musl-образе ERR_DLOPEN_FAILED (прод v1.34.0).
  outputFileTracingIncludes: {
    '/**': ['../../node_modules/.pnpm/@img+sharp-*/node_modules/@img/**'],
  },
  transpilePackages: ['@vire/core', '@vire/db', '@vire/ui'],
  images: {
    formats: ['image/avif', 'image/webp'],
    // Только нужные брейкпоинты — меньше вариантов кешируется на сервере.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [24, 36, 48, 64, 96, 128, 180, 256, 320],
    // Сутки вместо дефолтных 4ч: холодная AVIF-кодировка на слабом VPS ~2–3с и бьёт в LCP.
    // Дольше нельзя — ключ обложки стабилен (covers/{releaseId}), нужен запас на инвалидацию.
    minimumCacheTTL: 86400,
    remotePatterns: [
      s3RemotePattern(),
      { protocol: 'https', hostname: 'avatars.yandex.net', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 't.me', pathname: '/**' },
      // Обложки внешних треков вечеринки; список синхронизирован с img-src в buildCsp()
      // и с белым списком lib/external/cover-hosts.ts — чужие хосты туда не доезжают.
      { protocol: 'https', hostname: '**.ytimg.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.sndcdn.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.mzstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.scdn.co', pathname: '/**' },
      { protocol: 'https', hostname: '**.dzcdn.net', pathname: '/**' },
      { protocol: 'https', hostname: '**.userapi.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.mycdn.me', pathname: '/**' },
    ],
    // Next 16 блокирует оптимизацию с loopback IP (SSRF-защита); локальному MinIO нужен обход только в dev.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
  experimental: {
    // proxy.ts заставляет Next буферизовать тело запроса; дефолтные 10MB рвут multipart
    // у WAV-мастеров (formData() падает) — поднимаем под размер аудио (~10–17MB/мин).
    proxyClientMaxBodySize: '300mb',
  },
};

export default nextConfig;
