const timeFormatter = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });

/** Время сообщения: `14:05` сегодня, иначе `3 июл`. */
export function formatMessageTimestamp(date: Date, now: Date = new Date()): string {
  const d = new Date(date);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? timeFormatter.format(d) : dateFormatter.format(d);
}
