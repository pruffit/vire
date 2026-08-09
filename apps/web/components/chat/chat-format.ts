import type { useFormatter } from 'next-intl';

type Formatter = ReturnType<typeof useFormatter>;

/** Время сообщения: `14:05` сегодня, иначе `3 июл`. */
export function formatMessageTimestamp(date: Date, format: Formatter, now: Date = new Date()): string {
  const d = new Date(date);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? format.dateTime(d, { hour: '2-digit', minute: '2-digit' })
    : format.dateTime(d, { day: 'numeric', month: 'short' });
}
