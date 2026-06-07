import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vire/core', '@vire/db', '@vire/ui'],
  experimental: {
    // proxy.ts (Auth.js) заставляет Next 16 буферизовать тело запроса. Лимит по
    // умолчанию — 10MB: WAV-мастер крупнее обрезается, multipart-граница рвётся,
    // и req.formData() падает с "Invalid multipart form data". Поднимаем под
    // размер аудио-мастеров (WAV ~10–17MB/мин).
    proxyClientMaxBodySize: '300mb',
  },
};

export default nextConfig;
