/**
 * Раскладка мини-плеера в собственных координатах детали.
 *
 * Отдельно от компонента, потому что это чистая геометрия: по ней и рисуется краска, и
 * решается, что нажали. Величины — из макета (`apps/web/rnd-src/mini-player.ts`), в
 * масштабе экрана.
 */
export type PlateLayout = {
  /** Ширина плашки: приходит замером, плашка тянется по полю экрана. */
  plateW: number;
  pad: number;
  cover: number;
  coverRadius: number;
  textGap: number;
  play: number;
  /** Базовые линии строк относительно середины плашки. */
  titleBaseline: number;
  artistBaseline: number;
};

/** Величины макета (`apps/web/rnd-src/mini-player.ts`). */
export const MOCK_PLATE = {
  screenMargin: 20,
  inset: 9,
  radius: 16,
  coverRadius: 8,
  textGap: 12,
  play: 22,
  playHit: 18,
  title: 13,
  artist: 11,
  titleBaseline: -2,
  artistBaseline: 13,
  /** Зазор между значком плей и правым отступом. */
  playOffset: 4,
} as const;

/** Левый край плашки внутри коробки маски: коробка шире детали на запас деформации. */
export const plateLeft = (boxW: number, plateW: number) => (boxW - plateW) / 2;

/** Центр значка плей/паузы отмеряется от ПРАВОГО края (веб — `playCenterX`). */
export const playCenterX = (l: PlateLayout) =>
  l.plateW - l.pad - MOCK_PLATE.playOffset - l.play / 2;

/**
 * Попал ли тап по значку плей/паузы. Мимо него тап открывает плеер — так же решает веб
 * (`hitPlay`): плашка одна, а действий на ней два, и различает их координата.
 */
export function hitPlay(l: PlateLayout, local: { x: number; y: number }): boolean {
  const hit = (l.play * MOCK_PLATE.playHit) / MOCK_PLATE.play;
  const middle = l.cover / 2 + l.pad;
  return Math.abs(local.x - playCenterX(l)) <= hit && Math.abs(local.y - middle) <= hit;
}
