// Single source of truth for site-wide constants used by metadata, robots,
// sitemap and OpenGraph. SITE_URL drives metadataBase, so relative OG/canonical
// URLs resolve to absolute ones.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'Vire';

// Версия проекта — показывается в футере. Держим в синхроне с package.json.
export const SITE_VERSION = '1.0.38';

export const SITE_DESCRIPTION =
  'Независимая музыкальная площадка для артистов и слушателей СНГ';

// Полный заголовок по умолчанию (default title, OG, twitter) — один источник.
export const SITE_TITLE = `${SITE_NAME} — независимая музыкальная площадка`;
