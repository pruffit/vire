const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Синтаксическая проверка UUID. Нужна перед запросом по uuid-колонке: Postgres
 * на `where id = $1` с битой строкой кидает `invalid input syntax for type uuid`
 * (это исключение, а не пустой результат), и роут падает 500 вместо 404.
 * Битый UUID не может совпасть ни с одной строкой → корректно вернуть «не найдено».
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
