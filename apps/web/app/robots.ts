import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// force-dynamic: без него SITE_URL резолвится на сборке до AUTH_URL, Host/Sitemap уезжают на localhost
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/admin', '/profile', '/sign-in'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
