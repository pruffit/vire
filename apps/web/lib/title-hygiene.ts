/**
 * Контент-гигиена названий: детектор «артист продублировал своё имя в названии».
 *
 * Частый антипаттерн у артистов — называть трек/релиз «{Имя артиста} {название}»
 * («AVOCADICK Бедный музыкант»), хотя имя и так показывается рядом с обложкой.
 * Это чистая функция-детектор для мягкого инлайн-ворнинга (НЕ блокировка).
 */

/** Нижний регистр, схлопнутые пробелы, без крайних пробелов. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Похоже ли, что `title` начинается с имени артиста и далее идёт само название.
 * Регистронезависимо. Требует разделитель после имени и непустой остаток —
 * сингл, названный ровно именем артиста, не триггерит (остатка нет).
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
