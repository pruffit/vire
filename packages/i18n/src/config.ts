export const LOCALES = ['ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ru';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
};

// og:locale — формат Facebook/OpenGraph (язык_РЕГИОН), не совпадает с URL-локалью.
export const LOCALE_OG: Record<Locale, string> = {
  ru: 'ru_RU',
  en: 'en_US',
};
