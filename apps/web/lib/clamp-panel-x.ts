export interface ClampPanelXInput {
  /** Левая граница панели в системе координат вьюпорта, без применённого сдвига. */
  panelLeft: number;
  panelWidth: number;
  viewportWidth: number;
  margin: number;
}

/** Сдвиг по X, который держит панель внутри вьюпорта с полем `margin` с обеих сторон. */
export function clampPanelX({ panelLeft, panelWidth, viewportWidth, margin }: ClampPanelXInput): number {
  const available = viewportWidth - margin * 2;
  if (panelWidth > available) return margin - panelLeft;

  if (panelLeft < margin) return margin - panelLeft;

  const panelRight = panelLeft + panelWidth;
  const maxRight = viewportWidth - margin;
  if (panelRight > maxRight) return maxRight - panelRight;

  return 0;
}
