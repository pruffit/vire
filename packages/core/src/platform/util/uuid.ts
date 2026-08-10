const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Проверка перед запросом по uuid-колонке: битая строка в `where id = $1` роняет
// Postgres исключением (500), а не пустым результатом (404).
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
