// Site-wide constants for metadata/robots/sitemap/OG. SITE_URL drives metadataBase,
// so relative OG/canonical URLs resolve to absolute ones.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'VireMusic';

// Версия проекта — пробрасывается из package.json через next.config.ts.
export const SITE_VERSION = process.env.NEXT_PUBLIC_VERSION ?? '0.0.0';

export const SITE_DESCRIPTION =
  'Независимая музыкальная площадка для артистов и слушателей СНГ';

// Полный заголовок по умолчанию (default title, OG, twitter) — один источник.
export const SITE_TITLE = `${SITE_NAME} — независимая музыкальная площадка`;

export const SITE_LOCALE = 'ru_RU';

// файловая конвенция app/opengraph-image.tsx — фолбэк-картинка для страниц без своей
export const DEFAULT_OG_IMAGE_PATH = '/opengraph-image';

// один шаблон для <title> (root layout) и og:title/twitter:title (lib/metadata.ts) —
// без template.replace('%s', …) в двух местах.
export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;

export function applyTitleTemplate(title: string): string {
  return TITLE_TEMPLATE.replace('%s', title);
}
