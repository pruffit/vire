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

function buildCsp(): string {
  const s3 = s3Origin();
  const dev = process.env.NODE_ENV !== 'production';
  const parts = [
    `default-src 'self'`,
    // telegram.org нужен для виджета входа; vk.com для VK OAuth скриптов
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org`,
    `style-src 'self' 'unsafe-inline'`,
    // аватары: Yandex, Google (lh3), Telegram (t.me)
    `img-src 'self' data: blob: https://avatars.yandex.net https://lh3.googleusercontent.com https://t.me ${s3}`,
    `media-src 'self' blob: ${s3}`,
    `connect-src 'self' blob: ${s3}${dev ? ' ws://localhost:* wss://localhost:*' : ''}`,
    `font-src 'self' data:`,
    `worker-src blob:`,
    // oauth.telegram.org — iframe виджета Telegram Login
    `frame-src https://oauth.telegram.org`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
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
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
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
