import { NextResponse } from 'next/server';

interface CodedError extends Error {
  code?: string;
}

/**
 * Единая точка сериализации ошибки Result<> сервиса (packages/core) в JSON-ответ API.
 * `error` — техническое сообщение для логов (обычно русское), `code` — ключ для
 * клиентского перевода (apps/web/lib/api-error.ts → packages/i18n/messages/*\/errors.json).
 */
export function errorJson(error: CodedError, status: number): NextResponse {
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}
