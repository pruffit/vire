import type { NextConfig } from 'next';

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

const nextConfig: NextConfig = {
  transpilePackages: ['@vire/core', '@vire/db', '@vire/ui'],
  images: {
    remotePatterns: [s3RemotePattern()],
    // Next 16 блокирует оптимизацию картинок с приватных/loopback IP (SSRF-защита).
    // Локально MinIO живёт на localhost → разрешаем только в dev. На проде хранилище
    // (Selectel) публичное, поэтому флаг не нужен и остаётся выключенным.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
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
