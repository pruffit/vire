export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export class NotFoundError extends Error {
  readonly _tag = 'NotFoundError' as const;
  readonly resource: string;
  // code — стабильный ключ для клиентского перевода (packages/i18n/messages/*/errors.json);
  // message остаётся русским техническим текстом для логов.
  readonly code?: string;
  constructor(resource: string, id: string, code?: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.code = code;
  }
}

export class ConflictError extends Error {
  readonly _tag = 'ConflictError' as const;
  readonly code?: string;
  // Без id — resource используется как готовый текст ошибки (напр. занятый slug);
  // с id — стандартный формат "<resource> conflict: <id>".
  constructor(resource: string, id?: string, code?: string) {
    super(id !== undefined ? `${resource} conflict: ${id}` : resource);
    this.name = 'ConflictError';
    this.code = code;
  }
}

export class ValidationError extends Error {
  readonly _tag = 'ValidationError' as const;
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError' as const;
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ForbiddenError';
    this.code = code;
  }
}
