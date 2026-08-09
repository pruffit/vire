// Для поверхностей вне текущего среза локализации: app/admin/** (живёт вне next-intl,
// proxy.ts не пускает /admin в middleware) и lib/meta-descriptions.ts (SEO, срез H) —
// остаются русскими до своего среза; не тащим их в общий i18n-слой раньше времени.
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
