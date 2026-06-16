import type { LyricLine } from '@vire/core';

export type { LyricLine };

// Парсинг/сериализация LRC — формат синхронизированного текста: строки вида
// `[mm:ss.xx] текст`. Чистые функции, без эффектов. Поддерживают:
// - несколько таймкодов в одной строке (повторяющийся припев) → отдельные строки;
// - метатеги `[ar:]`, `[ti:]`, `[offset:]` и т.п. — игнорируются;
// - простой текст без таймкодов → строки с `t: null` (несинхронизированный).

const TS = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const ID_TAG = /^\[[a-z]{1,10}:[^\]]*\]$/i;

const MAX_LINES = 1000;
const MAX_TEXT = 300;

function toSeconds(min: string, sec: string, frac?: string): number {
  let t = parseInt(min, 10) * 60 + parseInt(sec, 10);
  if (frac) t += parseInt(frac, 10) / 10 ** frac.length;
  return Math.round(t * 1000) / 1000;
}

/** Разбирает LRC/простой текст в массив строк. Пустой ввод → []. */
export function parseLrc(raw: string): LyricLine[] {
  if (!raw || !raw.trim()) return [];
  const timed: LyricLine[] = [];
  const plain: LyricLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const stamps = [...line.matchAll(TS)];
    const text = line.replace(TS, '').trim().slice(0, MAX_TEXT);
    if (stamps.length > 0) {
      for (const m of stamps) timed.push({ t: toSeconds(m[1], m[2], m[3]), text });
    } else if (line.trim() && !ID_TAG.test(line.trim())) {
      plain.push({ t: null, text: line.trim().slice(0, MAX_TEXT) });
    }
  }

  const result = timed.length > 0 ? timed.sort((a, b) => (a.t ?? 0) - (b.t ?? 0)) : plain;
  return result.slice(0, MAX_LINES);
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t - Math.floor(t)) * 100);
  return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}]`;
}

/** Собирает строки обратно в LRC-текст — для предзаполнения редактора. */
export function serializeLrc(lines: LyricLine[] | null | undefined): string {
  if (!lines || lines.length === 0) return '';
  return lines.map((l) => (l.t != null ? `${formatTime(l.t)}${l.text}` : l.text)).join('\n');
}

/** Есть ли хотя бы один таймкод (синхронизированный текст). */
export function isSynced(lines: LyricLine[] | null | undefined): boolean {
  return !!lines && lines.some((l) => l.t != null);
}
