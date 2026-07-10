import type { z } from 'zod';
import type { ApiResult } from './result';

export interface RequestOptions<T> {
  method?: string;
  schema: z.ZodType<T>;
  body?: unknown;
}

const NETWORK_ERROR_MESSAGE = 'Нет соединения';
const INVALID_RESPONSE_MESSAGE = 'Неверный ответ сервера';
const DEFAULT_HTTP_ERROR_MESSAGE = 'Ошибка сервера';

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const json: unknown = await res.json();
    if (json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string') {
      return (json as { error: string }).error;
    }
  } catch {
    // тело не JSON — используем дефолт
  }
  return DEFAULT_HTTP_ERROR_MESSAGE;
}

/** Никогда не бросает наружу: сетевой сбой, HTTP-ошибка и невалидный ответ — все сводятся к `{ok:false}`. */
export async function request<T>(url: string, options: RequestOptions<T>): Promise<ApiResult<T>> {
  const { method = 'GET', schema, body } = options;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, error: { status: 0, message: NETWORK_ERROR_MESSAGE } };
  }

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    return { ok: false, error: { status: res.status, message } };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: { status: res.status, message: INVALID_RESPONSE_MESSAGE } };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: { status: res.status, message: INVALID_RESPONSE_MESSAGE } };
  }

  return { ok: true, data: parsed.data };
}
