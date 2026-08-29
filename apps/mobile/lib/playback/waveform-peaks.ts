/**
 * Сведение предрассчитанных пиков к фиксированному числу столбиков скраббера.
 *
 * Чистое и вынесено из компонента (`components/player/waveform.tsx`) намеренно: сам
 * компонент тянет react-native и в node-окружении не поднимается, а логика нормировки
 * стоит тестов — она решает, будет ли тихий трек виден вообще.
 */
export const WAVEFORM_BARS = 56;

/** Пол столбика: нулевой пик всё равно должен оставлять видимую засечку. */
const MIN_BAR = 0.12;

export function resamplePeaks(peaks: number[] | null, bars = WAVEFORM_BARS): number[] {
  if (!peaks || peaks.length === 0) return new Array(bars).fill(MIN_BAR);

  // Нормируем по максимуму трека, а не по абсолютной шкале: иначе тихая запись
  // рисуется плоской линией, а громкая упирается в потолок.
  let max = 0;
  for (const p of peaks) max = Math.max(max, Math.abs(p));
  if (max <= 0) return new Array(bars).fill(MIN_BAR);

  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * peaks.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / bars));
    let peak = 0;
    for (let j = from; j < to && j < peaks.length; j++) peak = Math.max(peak, Math.abs(peaks[j]));
    out.push(Math.max(MIN_BAR, peak / max));
  }
  return out;
}
