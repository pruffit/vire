export function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—:—';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

const FOLLOWER_FORMS = ['подписчик', 'подписчика', 'подписчиков'] as const;

/** Русское склонение по числу: 1 подписчик, 2 подписчика, 5 подписчиков. */
export function pluralFollowers(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return FOLLOWER_FORMS[2];
  if (n1 > 1 && n1 < 5) return FOLLOWER_FORMS[1];
  if (n1 === 1) return FOLLOWER_FORMS[0];
  return FOLLOWER_FORMS[2];
}

/** Крупные числа коротко: 1 240 → «1,2 тыс.». */
export function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) {
    const k = count / 1000;
    return `${k < 10 ? k.toFixed(1).replace('.', ',') : Math.round(k)} тыс.`;
  }
  const m = count / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace('.', ',') : Math.round(m)} млн`;
}
