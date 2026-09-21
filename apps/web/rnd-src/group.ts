// Разрыв и слияние (M 5:02): один орган управления растягивается, выпучивает будущие части и
// расходится на них перемычками. Тело при этом ОДНО — три формы в общей сцене, а не три детали.
import {
  createDeform,
  roundedRectGeometry,
} from 'vireglass';

const H = 62;
const DOT = H;
const DONE = { width: 132, corner: H / 2 };
const GAP = 16;
/** Ширина капсулы в собранном виде — «Select». */
const PILL = 168;
const PILL_R = H / 2;
const SPAN = DOT * 2 + DONE.width + GAP * 2;
/** Перемычка: в собранном виде части сплавлены в одну капсулу, в разведённом — врозь. */
const NECK = 24;
const GLYPH = 26;

type Box = { x: number; w: number; r: number };
type Spring = { x: number; v: number; target: number };

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

function stepSpring(s: Spring, dt: number, response: number, damping: number, instant = false): boolean {
  if (instant) {
    const moved = s.x !== s.target || s.v !== 0;
    s.x = s.target;
    s.v = 0;
    return moved;
  }
  const stiffness = ((2 * Math.PI) / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;
  const h = 1 / 240;
  for (let left = Math.min(dt, 0.05); left > 0; left -= h) {
    const step = Math.min(left, h);
    s.v += (stiffness * (s.target - s.x) - friction * s.v) * step;
    s.x += s.v * step;
  }
  if (Math.abs(s.target - s.x) < 1e-3 && Math.abs(s.v) < 1e-2) {
    s.x = s.target;
    s.v = 0;
    return false;
  }
  return true;
}

/** `center` — середина группы в CSS-пикселях кадра. */
export function createGroup(center: () => { x: number; y: number }, instant = false) {
  const split: Spring = { x: 0, v: 0, target: 0 };
  const deform = createDeform();
  // Свет живёт у ПЕРЕХОДА, а не у состояния: он вспыхивает на разрыве и гаснет сам.
  let heat = 0;
  let apart = false;

  /** В собранном виде все три части СОВПАДАЮТ с капсулой: тело одно, и разрыв выпучивает
   *  части из него, а не собирает капсулу из заранее разложенных кусков. */
  function boxes() {
    const { x, y } = center();
    const t = Math.max(split.x, 0);
    const slots = [
      { spread: -(SPAN - DOT) / 2, w: DOT, r: DOT / 2 },
      { spread: -(SPAN - DOT) / 2 + DOT + GAP, w: DOT, r: DOT / 2 },
      { spread: (SPAN - DONE.width) / 2, w: DONE.width, r: DONE.corner },
    ];
    const parts: Box[] = slots.map((slot) => ({
      x: x + slot.spread * t,
      w: mix(PILL, slot.w, t),
      r: mix(PILL_R, slot.r, t),
    }));
    // Ноль перемычки выключил бы вторую форму целиком, поэтому у разведённых частей она
    // остаётся волоском: smin с таким k — это уже обычный min.
    const neck = Math.max(mix(NECK, 0, t), 0.75);
    return { parts, y, neck, t };
  }

  function frame(density: number) {
    const { parts, y, neck } = boxes();
    const d = deform.sample();
    const main = parts[2];
    const press = Math.max(d.press, heat);
    return {
      geometry: roundedRectGeometry(main.w, H, main.r),
      centerX: main.x * density,
      centerY: y * density,
      morph: {
        offsetX: parts[0].x - main.x,
        offsetY: 0,
        width: parts[0].w,
        height: H,
        cornerRadius: parts[0].r,
        smoothing: neck,
      },
      morph2: {
        offsetX: parts[1].x - main.x,
        offsetY: 0,
        width: parts[1].w,
        height: H,
        cornerRadius: parts[1].r,
        smoothing: neck,
      },
      touch: {
        x: d.touchX,
        y: d.touchY,
        pullX: d.pullX,
        pullY: d.pullY,
        press,
        radius: 0.72 * (H / 2),
        waveAmp: d.waveAmp,
        wavePhase: d.wavePhase,
      },
      press,
    };
  }

  function pick(px: number, py: number) {
    const { parts, y } = boxes();
    const left = Math.min(...parts.map((p) => p.x - p.w / 2));
    const right = Math.max(...parts.map((p) => p.x + p.w / 2));
    if (px < left - 6 || px > right + 6 || Math.abs(py - y) > H / 2 + 6) return null;
    return { localX: px - parts[2].x, localY: py - y };
  }

  function click(): void {
    apart = !apart;
    heat = 1;
  }

  function step(dt: number): boolean {
    split.target = apart ? 1 : 0;
    const moving = stepSpring(split, dt, apart ? 0.8 : 0.7, 0.85, instant);
    deform.step(dt);
    if (instant) heat = 0;
    if (heat > 0.002) {
      heat *= Math.exp(-dt / 0.45);
      if (heat <= 0.002) heat = 0;
      return true;
    }
    return moving || !deform.idle();
  }

  function drawInk(ctx: CanvasRenderingContext2D, density: number): void {
    const { parts, y, t } = boxes();
    const together = 1 - smooth(0, 0.32, t);
    const apartInk = smooth(0.45, 0.92, t);
    ctx.save();
    ctx.scale(density, density);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Краска сменяется расфокусом: на разрыве глифы уходят и приходят размытыми (M 5:03).
    if (together > 0.01) {
      ctx.globalAlpha = together;
      ctx.filter = together < 0.99 ? `blur(${(1 - together) * 5 * density}px)` : 'none';
      ctx.font = '600 21px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillText('Select', center().x, y + 1);
    }
    if (apartInk > 0.01) {
      ctx.globalAlpha = apartInk;
      ctx.filter = apartInk < 0.99 ? `blur(${(1 - apartInk) * 5 * density}px)` : 'none';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(parts[0].x, y, GLYPH / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
      const s = GLYPH / 2;
      ctx.beginPath();
      ctx.moveTo(parts[1].x, y - s + 2);
      ctx.lineTo(parts[1].x + s - 1, y + s - 3);
      ctx.lineTo(parts[1].x - s + 1, y + s - 3);
      ctx.closePath();
      ctx.stroke();
      ctx.font = '600 21px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillText('Done', parts[2].x, y + 1);
    }
    ctx.restore();
  }

  return { deform, frame, pick, click, step, drawInk, isApart: () => apart };
}
