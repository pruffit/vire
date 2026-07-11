// Site-wide constants for metadata/robots/sitemap/OG. SITE_URL drives metadataBase,
// so relative OG/canonical URLs resolve to absolute ones.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'Vire';

// Версия проекта — пробрасывается из package.json через next.config.ts.
export const SITE_VERSION = process.env.NEXT_PUBLIC_VERSION ?? '0.0.0';

export const SITE_DESCRIPTION =
  'Независимая музыкальная площадка для артистов и слушателей СНГ';

// Полный заголовок по умолчанию (default title, OG, twitter) — один источник.
export const SITE_TITLE = `${SITE_NAME} — независимая музыкальная площадка`;
