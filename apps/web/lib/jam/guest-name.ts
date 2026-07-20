const ADJECTIVES = ['Тихий', 'Громкий', 'Ночной', 'Быстрый', 'Тёплый', 'Дикий', 'Ясный', 'Смелый'];
const NOUNS = ['Слушатель', 'Гость', 'Диджей', 'Танцор', 'Мелофил', 'Басист'];

/** Дефолт для поля имени на экране входа — не задумываться, просто подтвердить. */
export function generateGuestName(random: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}
