import { createTranslator } from 'use-intl';
import type { Locale } from './config';
import { getMessages } from './messages';

/** Переводчик вне React-дерева — письма, пуш, воркер (apps/worker). */
export async function getTranslator(locale: Locale) {
  const messages = await getMessages(locale);
  return createTranslator({ locale, messages });
}
