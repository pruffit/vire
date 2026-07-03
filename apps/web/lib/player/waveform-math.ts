// Чистая математика для waveform-скраббера: усреднение пиков в бары и перевод
// координаты указателя в прогресс (0..1). Без React/DOM — тестируется изолированно.

/** Усредняет пики в `barCount` баров. Без пиков — детерминированная псевдо-волна
 *  (плейсхолдер), чтобы скраббер не схлопывался в пустоту до готовности waveform. */
export function buildBars(peaks: number[] | null, barCount: number): number[] {
  if (barCount <= 0) return [];
  if (!peaks || peaks.length === 0) {
    return Array.from({ length: barCount }, (_, i) => 0.3 + 0.4 * Math.abs(Math.sin(i * 0.4)));
  }
  const step = peaks.length / barCount;
  return Array.from({ length: barCount }, (_, i) => {
    const from = Math.floor(i * step);
    const to = Math.min(Math.ceil((i + 1) * step), peaks.length);
    const slice = peaks.slice(from, to);
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  });
}

/** Позиция указателя внутри прямоугольника → прогресс 0..1, кламп по краям. */
export function ratioFromX(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}
