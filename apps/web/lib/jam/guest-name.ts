const ADJECTIVES = ['Тихий', 'Громкий', 'Ночной', 'Быстрый', 'Тёплый', 'Дикий', 'Ясный', 'Смелый'];
const NOUNS = ['Слушатель', 'Гость', 'Диджей', 'Танцор', 'Мелофил', 'Басист'];

/** Дефолт для поля имени на экране входа — не задумываться, просто подтвердить.
 *  Списки слов передаёт вызывающий (переведённые из словаря jam) — эти два массива
 *  остаются лишь запасным значением по умолчанию. */
export function generateGuestName(
  random: () => number = Math.random,
  adjectives: readonly string[] = ADJECTIVES,
  nouns: readonly string[] = NOUNS,
): string {
  const adjective = adjectives[Math.floor(random() * adjectives.length)];
  const noun = nouns[Math.floor(random() * nouns.length)];
  return `${adjective} ${noun}`;
}
