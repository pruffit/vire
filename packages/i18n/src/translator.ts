import { createTranslator } from 'use-intl';
import type { Locale } from './config';
import { getMessages } from './messages';

/** Переводчик вне React-дерева — письма, пуш, воркер (apps/worker), а также
 *  серверные файлы apps/web вне app/[locale] (root not-found/error), где
 *  next-intl/server недоступен (нет AsyncLocalStorage запроса). */
export async function getTranslator(locale: Locale, namespace?: string) {
  const messages = await getMessages(locale);
  // namespace приходит произвольной строкой (вызовы из apps/web) — конкретные литералы
  // проверяет next-intl уже в рантайме через ключи messages, а не этот дженерик.
  return createTranslator({ locale, messages, namespace } as Parameters<typeof createTranslator>[0]);
}
