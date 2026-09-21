// Меню «ещё» растёт из капсулы (M 5:11): одно тело проходит путь капсула → капля → меню.
// Фаз две, как в эталоне: капсула сперва стягивается в каплю, и только потом капля растёт.
import { createDeform, roundedRectGeometry } from 'vireglass';
import { drawIcon, type IconName } from './icons';

const ITEMS: readonly { icon: IconName; label: string }[] = [
  { icon: 'vire-list-plus', label: 'В плейлист' },
  { icon: 'vire-user', label: 'К артисту' },
  { icon: 'vire-music', label: 'Открыть релиз' },
  { icon: 'vire-link', label: 'Копировать ссылку' },
];
const CAPSULE_ICONS: readonly IconName[] = ['vire-align-center', 'vire-more-horizontal'];
export const POPOVER_ICONS: readonly IconName[] = [...CAPSULE_ICONS, ...ITEMS.map((item) => item.icon)];

export const CAPSULE = { width: 84, height: 40 };
const ROW = 44;
const PAD = 8;
const MENU_WIDTH = 206;
const MENU_HEIGHT = PAD * 2 + ITEMS.length * ROW;
const MENU_CORNER = 26;
const ICON = 20;
const GLYPH_STEP = 18;
/** Капля — в долях высоты капсулы: диаметр и вынос в сторону меню. */
const DROP = 1.1;
const DROP_LIFT = 0.5;

export type PopoverHit = 'more' | 'lyrics' | 'item';

type Spring = { x: number; v: number; target: number };
type Box = { x: number; y: number; w: number; h: number; r: number };

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const half = (b: Box) => Math.min(b.w, b.h) / 2;

/** Пружина с откликом `response` секунд; `damping` < 1 даёт перелёт. */
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

/** `anchor` — правый верхний угол капсулы в CSS-пикселях кадра: из него меню и растёт. */
export function createPopover(anchor: () => { right: number; top: number }, instant = false) {
  const shrink: Spring = { x: 0, v: 0, target: 0 };
  const grow: Spring = { x: 0, v: 0, target: 0 };
  const deform = createDeform();
  let open = false;

  function layout() {
    const { right, top } = anchor();
    const c0 = { x: right - CAPSULE.width / 2, y: top + CAPSULE.height / 2 };
    const toMenu = { x: right - MENU_WIDTH / 2 - c0.x, y: top + MENU_HEIGHT / 2 - c0.y };
    const len = Math.hypot(toMenu.x, toMenu.y) || 1;
    const lift = DROP_LIFT * CAPSULE.height;
    const drop = { x: c0.x + (toMenu.x / len) * lift, y: c0.y + (toMenu.y / len) * lift };
    return { right, top, c0, drop };
  }

  /** Источник — капсула, стянутая в каплю; тело — капля, выросшая в меню. Сцена — их слияние. */
  function shapes() {
    const { right, top, c0, drop } = layout();
    const a = Math.min(Math.max(shrink.x, 0), 1);
    const b = Math.max(grow.x, 0);
    const keep = Math.max(1 - b, 0);
    const d = DROP * CAPSULE.height;
    const source: Box = {
      x: mix(c0.x, drop.x, a),
      y: mix(c0.y, drop.y, a),
      w: mix(CAPSULE.width, 0.6 * d, a) * keep,
      h: mix(CAPSULE.height, 0.6 * d, a) * keep,
      r: 0,
    };
    source.r = half(source);
    const size = d * Math.sqrt(a);
    const w = mix(size, MENU_WIDTH, b);
    const h = mix(size, MENU_HEIGHT, b);
    // Перелёт растит меню от угла-якоря, а не сдвигает сам угол.
    const edgeX = mix(drop.x + size / 2, right, Math.min(b, 1));
    const edgeY = mix(drop.y - size / 2, top, Math.min(b, 1));
    const body: Box = { x: edgeX - w / 2, y: edgeY + h / 2, w, h, r: 0 };
    body.r = Math.min(mix(half(body), MENU_CORNER, smooth(0.55, 1, b)), half(body));
    const neck = 0.3 * CAPSULE.height * Math.min(a * 4, 1) * keep;
    // Главная форма — бо́льшая по полуразмеру: от него считаются толщина и фаска, поэтому роли
    // меняются ровно при равных полуразмерах и на кадре это не видно.
    const main = half(body) >= half(source) ? body : source;
    const other = main === body ? source : body;
    return { main, other, body, neck };
  }

  function frame(density: number) {
    const { main, other, body, neck } = shapes();
    const d = deform.sample();
    const bloom = smooth(0, 0.6, shrink.x) * (1 - smooth(0.5, 1, grow.x));
    const united = neck > 0.01 && other.w > 0.5 && other.h > 0.5;
    // В пути свет идёт из капли, под пальцем — из точки касания; вес общий, чтобы пятно не прыгало.
    const fromDrop = bloom / (bloom + d.press + 1e-3);
    return {
      geometry: roundedRectGeometry(Math.max(main.w, 1), Math.max(main.h, 1), main.r),
      centerX: main.x * density,
      centerY: main.y * density,
      morph: united
        ? {
            offsetX: other.x - main.x,
            offsetY: other.y - main.y,
            width: other.w,
            height: other.h,
            cornerRadius: other.r,
            smoothing: neck,
          }
        : undefined,
      touch: {
        x: mix(d.touchX, body.x - main.x, fromDrop),
        y: mix(d.touchY, body.y - main.y, fromDrop),
        pullX: d.pullX,
        pullY: d.pullY,
        press: Math.max(d.press, bloom),
        radius: 0.72 * Math.max(half(main), 1),
        waveAmp: d.waveAmp,
        wavePhase: d.wavePhase,
      },
      press: Math.max(d.press, bloom),
    };
  }

  function pick(x: number, y: number) {
    const { main } = shapes();
    if (Math.abs(x - main.x) > main.w / 2 + 6 || Math.abs(y - main.y) > main.h / 2 + 6) return null;
    const hit: PopoverHit = open ? 'item' : x >= layout().c0.x ? 'more' : 'lyrics';
    return { hit, localX: x - main.x, localY: y - main.y, halfMin: half(main) };
  }

  function click(hit: PopoverHit): void {
    if (open) open = false;
    else if (hit === 'more') open = true;
  }

  function step(dt: number): boolean {
    // Меню начинает расти, когда капля уже собралась; капсула возвращается, когда меню стекло в каплю.
    // Без движения фазам ждать друг друга незачем: обе встают за один кадр.
    if (instant) {
      shrink.target = open ? 1 : 0;
      grow.target = open ? 1 : 0;
    } else if (open) {
      shrink.target = 1;
      if (shrink.x > 0.8) grow.target = 1;
    } else {
      grow.target = 0;
      if (grow.x < 0.12) shrink.target = 0;
    }
    const a = stepSpring(shrink, dt, open ? 0.38 : 0.3, 1, instant);
    const b = stepSpring(grow, dt, open ? 0.46 : 0.4, open ? 0.72 : 1, instant);
    deform.step(dt);
    return a || b || !deform.idle();
  }

  function drawInk(ctx: CanvasRenderingContext2D, density: number): void {
    const { right, top, c0 } = layout();
    const glyphs = 1 - smooth(0, 0.4, shrink.x);
    const content = smooth(0.45, 0.95, grow.x);
    ctx.save();
    ctx.scale(density, density);
    // Краска уходит и приходит расфокусом, а не одной прозрачностью (M 5:13).
    if (glyphs > 0.01) {
      ctx.globalAlpha = glyphs;
      ctx.filter = glyphs < 0.99 ? `blur(${(1 - glyphs) * 4 * density}px)` : 'none';
      CAPSULE_ICONS.forEach((icon, i) => {
        ctx.save();
        ctx.translate(c0.x + (i === 0 ? -GLYPH_STEP : GLYPH_STEP), c0.y);
        drawIcon(ctx, icon, ICON);
        ctx.restore();
      });
    }
    if (content > 0.01) {
      ctx.globalAlpha = content;
      ctx.filter = content < 0.99 ? `blur(${(1 - content) * 7 * density}px)` : 'none';
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const left = right - MENU_WIDTH + 16;
      ITEMS.forEach((item, i) => {
        const y = top + PAD + ROW * (i + 0.5);
        ctx.save();
        ctx.translate(left + ICON / 2, y);
        drawIcon(ctx, item.icon, ICON);
        ctx.restore();
        ctx.fillText(item.label, left + ICON + 12, y + 0.5);
      });
    }
    ctx.restore();
  }

  return {
    deform,
    frame,
    pick,
    click,
    step,
    drawInk,
    isOpen: () => open,
    setOpen: (next: boolean) => {
      open = next;
    },
  };
}
