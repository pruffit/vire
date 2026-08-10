import { DEFAULT_LOCALE, LOCALE_OG, type Locale } from '@vire/i18n/config';
import { getTranslator } from '@vire/i18n/translator';

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

// Локаль по умолчанию — фолбэк для поверхностей вне next-intl (app/admin, robots,
// корневой opengraph-image), где нет запроса с определённой локалью.
export async function siteDescription(locale: Locale = DEFAULT_LOCALE): Promise<string> {
  const t = await getTranslator(locale, 'seo');
  return t('siteDescription');
}

export async function siteTitle(locale: Locale = DEFAULT_LOCALE): Promise<string> {
  const t = await getTranslator(locale, 'seo');
  return `${SITE_NAME} — ${t('siteTitleSuffix')}`;
}

export function siteLocale(locale: Locale = DEFAULT_LOCALE): string {
  return LOCALE_OG[locale] ?? LOCALE_OG[DEFAULT_LOCALE];
}

// файловая конвенция app/opengraph-image.tsx — фолбэк-картинка для страниц без своей
export const DEFAULT_OG_IMAGE_PATH = '/opengraph-image';

// один шаблон для <title> (root layout) и og:title/twitter:title (lib/metadata.ts) —
// без template.replace('%s', …) в двух местах.
export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;

export function applyTitleTemplate(title: string): string {
  return TITLE_TEMPLATE.replace('%s', title);
}
