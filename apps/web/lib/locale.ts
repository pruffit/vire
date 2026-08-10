import { getLocale } from 'next-intl/server';
import { isLocale, DEFAULT_LOCALE, type Locale } from '@vire/i18n/config';

// next-intl's getLocale() возвращает use-intl's Locale (string без глобальной аугментации) —
// сужаем до нашего строгого союза для мест, которые типизированы по @vire/i18n.
export async function resolveLocale(): Promise<Locale> {
  const raw = await getLocale();
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}
