// Краевой эффект прокрутки (эталон 219 @8:52): контент под панелью не обрезается, а уходит в
// расфокус, нарастающий к краю, и растворяется в фон — или тонет в лёгком затемнении.
import type { ScrollEdgeStyle } from '@vire/vireglass';

/** Расфокус у самой панели, dp; к внутренней границе полосы он сходит на нет. */
const MAX_BLUR_DP = 14;
/** Полоса режется на ломти со своим радиусом: каждая строка рисуется ОДИН раз, и резкая копия
 *  не просвечивает сквозь размытую — двойного изображения нет. */
const SLICES = 10;

export type ScrollEdge = {
  /** Полоса эффекта, device-px. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** С какой стороны полосы стоит панель: там эффект сильнее всего. */
  side: 'top' | 'bottom';
  style: ScrollEdgeStyle;
  /** Цвет растворения, `r,g,b`. */
  fill: string;
  /** 0..1 — насколько контент заехал под панель; без прокрутки эффекта нет. */
  strength: number;
  /** Своя вуаль не нужна, когда затемнение у края уже держит скрим экрана. */
  veil?: boolean;
};

const band = document.createElement('canvas');

/**
 * Расфокус наводится В САМОМ СЛОЕ, а не поверх фона: слой прозрачен вне строк, и полосу в нём
 * можно стереть и положить заново. Рисовать размытую копию поверх резкой нельзя — сквозь неё
 * просвечивает резкая, и строка двоится.
 */
function defocus(layer: HTMLCanvasElement, edge: ScrollEdge, density: number): void {
  const ctx = layer.getContext('2d');
  const margin = MAX_BLUR_DP * density * 2;
  const top = Math.max(edge.y - margin, 0);
  const height = Math.min(edge.height + margin * 2, layer.height - top);
  if (!ctx || height <= 0) return;

  if (band.width !== edge.width || band.height !== height) {
    band.width = edge.width;
    band.height = height;
  }
  const into = band.getContext('2d');
  if (!into) return;
  into.clearRect(0, 0, band.width, band.height);

  const slice = edge.height / SLICES;
  for (let i = 0; i < SLICES; i += 1) {
    // 0 — ломоть у самой панели, 1 — у внутренней границы полосы.
    const f = (i + 0.5) / SLICES;
    const blur = MAX_BLUR_DP * density * edge.strength * (1 - f) ** 1.5;
    const sliceTop =
      edge.side === 'top' ? edge.y + i * slice : edge.y + edge.height - (i + 1) * slice;
    into.save();
    into.beginPath();
    into.rect(0, sliceTop - top, edge.width, slice + 0.5);
    into.clip();
    into.filter = blur > 0.3 ? `blur(${blur}px)` : 'none';
    into.drawImage(layer, edge.x, top, edge.width, height, 0, 0, edge.width, height);
    into.restore();
  }

  ctx.clearRect(edge.x, edge.y, edge.width, edge.height);
  ctx.drawImage(band, 0, edge.y - top, edge.width, edge.height, edge.x, edge.y, edge.width, edge.height);
}

export function drawWithScrollEdges(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  edges: readonly ScrollEdge[],
  density: number,
): void {
  for (const edge of edges) {
    if (edge.strength > 0.001 && edge.style !== 'hard') defocus(layer, edge, density);
  }
  ctx.drawImage(layer, 0, 0);

  for (const edge of edges) {
    if (edge.strength <= 0.001) continue;
    if (edge.style === 'hard') {
      ctx.fillStyle = `rgba(${edge.fill},${0.85 * edge.strength})`;
      ctx.fillRect(edge.x, edge.y, edge.width, edge.height);
      continue;
    }
    if (edge.veil === false) continue;
    const veil =
      edge.side === 'top'
        ? ctx.createLinearGradient(0, edge.y, 0, edge.y + edge.height)
        : ctx.createLinearGradient(0, edge.y + edge.height, 0, edge.y);
    const color = edge.style === 'dim' ? '0,0,0' : edge.fill;
    const peak = (edge.style === 'dim' ? 0.35 : 0.85) * edge.strength;
    veil.addColorStop(0, `rgba(${color},${peak})`);
    veil.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = veil;
    ctx.fillRect(edge.x, edge.y, edge.width, edge.height);
  }
}
