import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// force-dynamic: без него SITE_URL резолвится на сборке до AUTH_URL, Host/Sitemap уезжают на localhost
export const dynamic = 'force-dynamic';

// robots.txt matching — префиксное: 'Disallow: /dashboard' не блокирует '/en/dashboard',
// поэтому приватные разделы дублируются под /en (localePrefix: 'as-needed', ru без префикса).
const PRIVATE_PATHS = ['/dashboard', '/admin', '/profile', '/sign-in'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...PRIVATE_PATHS, ...PRIVATE_PATHS.map((p) => `/en${p}`)],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
