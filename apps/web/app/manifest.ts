import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE } from '@vire/i18n/config';
import { getTranslator } from '@vire/i18n/translator';
import { SITE_NAME, siteDescription, siteTitle } from '@/lib/site';

// Манифест — один файл на всё приложение (app/manifest.ts живёт вне app/[locale],
// proxy.ts исключает пути с точкой из next-intl middleware — локали запроса нет).
// Отдаём дефолтную локаль (ru): один <link rel="manifest"> в head, второй язык
// потребовал бы отдельного манифеста и переключения ссылки в layout по локали.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [name, description, t] = await Promise.all([
    siteTitle(DEFAULT_LOCALE),
    siteDescription(DEFAULT_LOCALE),
    getTranslator(DEFAULT_LOCALE),
  ]);

  return {
    id: '/',
    name,
    short_name: SITE_NAME,
    description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#141414',
    theme_color: '#141414',
    lang: DEFAULT_LOCALE,
    categories: ['music', 'entertainment'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: t('nav.tabBar.search'), url: '/search' },
      { name: t('nav.tabBar.library'), url: '/library' },
      { name: t('pwa.offline.pageTitle'), url: '/offline' },
    ],
  };
}
