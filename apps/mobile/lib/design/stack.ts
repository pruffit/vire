/**
 * Излишек высоты первого экрана раскладывается по всем вертикальным зазорам пропорционально
 * их макетным величинам, а не достаётся одному месту целиком (`docs/superpowers/specs/
 * 2026-09-11-player-phone-defects.md`, п.2).
 */
export function distributeSurplus(gaps: readonly number[], surplus: number): number[] {
  const total = gaps.reduce((sum, w) => sum + w, 0);
  if (surplus <= 0 || total <= 0) return gaps.map(() => 0);
  return gaps.map((w) => (surplus * w) / total);
}
