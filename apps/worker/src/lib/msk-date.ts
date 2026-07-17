// МСК не переходит на летнее время — фиксированный UTC+3 корректен круглый год.
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Вчерашний день по Europe/Moscow (YYYY-MM-DD), не зависит от TZ хоста. */
export function yesterdayMsk(now: Date): string {
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  const yesterday = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - 1));
  return `${yesterday.getUTCFullYear()}-${pad2(yesterday.getUTCMonth() + 1)}-${pad2(yesterday.getUTCDate())}`;
}
