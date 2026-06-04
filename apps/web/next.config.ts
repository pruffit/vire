import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vire/db', '@vire/ui'],
};

export default nextConfig;
