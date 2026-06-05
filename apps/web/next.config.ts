import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vire/core', '@vire/db', '@vire/ui'],
};

export default nextConfig;
