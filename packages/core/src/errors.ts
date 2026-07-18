export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export class NotFoundError extends Error {
  readonly _tag = 'NotFoundError' as const;
  readonly resource: string;
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

export class ConflictError extends Error {
  readonly _tag = 'ConflictError' as const;
  // Без id — resource используется как готовый текст ошибки (напр. занятый slug);
  // с id — стандартный формат "<resource> conflict: <id>".
  constructor(resource: string, id?: string) {
    super(id !== undefined ? `${resource} conflict: ${id}` : resource);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  readonly _tag = 'ValidationError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
