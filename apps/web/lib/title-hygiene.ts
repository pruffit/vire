/** Детектор «артист продублировал своё имя в названии» («AVOCADICK Бедный музыкант») — чистая функция для мягкого инлайн-ворнинга, не блокировка. */

/** Нижний регистр, схлопнутые пробелы, без крайних пробелов. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Начинается ли `title` с имени артиста и разделителя, с непустым остатком после
 * (регистронезависимо; сингл, названный ровно именем артиста, не триггерит).
 *
 * @example titleRepeatsArtist('AVOCADICK Бедный музыкант', 'AVOCADICK') // true
 * @example titleRepeatsArtist('Бедный музыкант', 'AVOCADICK')           // false
 * @example titleRepeatsArtist('AVOCADICK', 'AVOCADICK')                 // false
 */
export function titleRepeatsArtist(title: string, artistName: string): boolean {
  const t = norm(title);
  const a = norm(artistName);
  if (a.length < 2 || !t.startsWith(a)) return false;
  const rest = t.slice(a.length);
  // сразу после имени должен идти разделитель (пробел/дефис/тире/двоеточие/«|»/точка)…
  if (!/^[\s\-–—:|.]/.test(rest)) return false;
  // …и после всех разделителей — непустой осмысленный остаток (а не один дефис).
  return rest.replace(/^[\s\-–—:|.]+/, '').length > 0;
}
