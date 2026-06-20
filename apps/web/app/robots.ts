import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// SITE_URL резолвится из AUTH_URL в рантайме. Без этого robots генерится
// статически на сборке, где AUTH_URL ещё нет → Host/Sitemap падают на
// localhost:3000, и Яндекс считает главным зеркалом localhost («страница
// недоступна» при подтверждении прав). force-dynamic читает реальный хост.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Приватные и служебные разделы не индексируем
      disallow: ['/api/', '/dashboard', '/admin', '/profile', '/sign-in'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
