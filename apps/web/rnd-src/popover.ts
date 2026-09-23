// Меню «ещё» растёт из капсулы (M 5:11): хореография — в vireuikit (kit/morph.ts),
// здесь только раскладка (размеры, якорь) и рисование.
import { capsuleGeometry, createDeform, halfMinDp, roundedRectGeometry } from 'vireglass';
import {
  createGrowthState,
  growthFrame,
  growthInk,
  growthPhase,
  smoothstep,
  stepGrowth,
  type GrowthShape,
} from 'vireuikit';
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

const SOURCE_GEOMETRY = capsuleGeometry(CAPSULE.width, CAPSULE.height);
const TARGET_GEOMETRY = roundedRectGeometry(MENU_WIDTH, MENU_HEIGHT, MENU_CORNER);

export type PopoverHit = 'more' | 'lyrics' | 'item';

/** `anchor` — правый верхний угол капсулы в CSS-пикселях кадра: из него меню и растёт. */
export function createPopover(anchor: () => { right: number; top: number }, instant = false) {
  const state = createGrowthState();
  const deform = createDeform();
  let open = false;

  function layout() {
    const { right, top } = anchor();
    const source: GrowthShape = {
      geometry: SOURCE_GEOMETRY,
      center: { x: right - CAPSULE.width / 2, y: top + CAPSULE.height / 2 },
    };
    const target: GrowthShape = {
      geometry: TARGET_GEOMETRY,
      center: { x: right - MENU_WIDTH / 2, y: top + MENU_HEIGHT / 2 },
    };
    return { right, top, source, target };
  }

  function frame(density: number) {
    const { right, top, source, target } = layout();
    const phase = growthPhase(state);
    const g = growthFrame(source, target, { x: right, y: top }, phase);
    const main = g.body;
    const d = deform.sample();
    // В пути свет идёт из капли, под пальцем — из точки касания; вес общий, чтобы пятно не прыгало.
    const bloom = smoothstep(0, 0.6, phase.shrink) * (1 - smoothstep(0.5, 1, phase.grow));
    const fromDrop = bloom / (bloom + d.press + 1e-3);
    return {
      geometry: roundedRectGeometry(
        Math.max(main.geometry.width, 1),
        Math.max(main.geometry.height, 1),
        main.geometry.cornerRadius,
      ),
      centerX: main.center.x * density,
      centerY: main.center.y * density,
      morph: g.merge,
      touch: {
        x: d.touchX + (g.grown.center.x - main.center.x - d.touchX) * fromDrop,
        y: d.touchY + (g.grown.center.y - main.center.y - d.touchY) * fromDrop,
        pullX: d.pullX,
        pullY: d.pullY,
        press: Math.max(d.press, bloom),
        radius: 0.72 * Math.max(halfMinDp(main.geometry), 1),
        waveAmp: d.waveAmp,
        wavePhase: d.wavePhase,
      },
      press: Math.max(d.press, bloom),
    };
  }

  function pick(x: number, y: number) {
    const { right, top, source, target } = layout();
    const main = growthFrame(source, target, { x: right, y: top }, growthPhase(state)).body;
    if (
      Math.abs(x - main.center.x) > main.geometry.width / 2 + 6 ||
      Math.abs(y - main.center.y) > main.geometry.height / 2 + 6
    )
      return null;
    const hit: PopoverHit = open ? 'item' : x >= source.center.x ? 'more' : 'lyrics';
    return {
      hit,
      localX: x - main.center.x,
      localY: y - main.center.y,
      halfMin: halfMinDp(main.geometry),
    };
  }

  function click(hit: PopoverHit): void {
    if (open) open = false;
    else if (hit === 'more') open = true;
  }

  function step(dt: number): boolean {
    const moving = stepGrowth(state, dt, open, instant);
    deform.step(dt);
    return moving || !deform.idle();
  }

  function drawInk(ctx: CanvasRenderingContext2D, density: number): void {
    const { right, top, source } = layout();
    const { outgoing, incoming } = growthInk(growthPhase(state));
    ctx.save();
    ctx.scale(density, density);
    if (outgoing > 0.01) {
      ctx.globalAlpha = outgoing;
      ctx.filter = outgoing < 0.99 ? `blur(${(1 - outgoing) * 4 * density}px)` : 'none';
      CAPSULE_ICONS.forEach((icon, i) => {
        ctx.save();
        ctx.translate(source.center.x + (i === 0 ? -GLYPH_STEP : GLYPH_STEP), source.center.y);
        drawIcon(ctx, icon, ICON);
        ctx.restore();
      });
    }
    if (incoming > 0.01) {
      ctx.globalAlpha = incoming;
      ctx.filter = incoming < 0.99 ? `blur(${(1 - incoming) * 7 * density}px)` : 'none';
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
