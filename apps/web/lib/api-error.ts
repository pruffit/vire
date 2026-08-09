import type { useTranslations } from 'next-intl';

type ErrorsTranslator = ReturnType<typeof useTranslations<'errors'>>;

interface ApiErrorPayload {
  error?: string;
  code?: string;
}

/**
 * Человекочитаемое сообщение об ошибке API: код от сервера → перевод из errors.json
 * (`useTranslations('errors')`), фолбэк — серверный текст, затем `fallback`.
 */
export function apiErrorMessage(t: ErrorsTranslator, data: ApiErrorPayload | null | undefined, fallback: string): string {
  if (data?.code && t.has(data.code)) return t(data.code);
  return data?.error ?? fallback;
}
