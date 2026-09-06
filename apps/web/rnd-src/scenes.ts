// Два фона стенда: светлая и тёмная тонкая клетка. Клетка, а не заливка и не картинка —
// тонкая прямая линия показывает работу линзы честнее всего: любое искажение, увод или
// разрыв видно сразу. Ни один фон не доведён до чистого чёрного или белого: на крайних
// значениях материал выглядит хорошо слишком легко, и решения по ним принимать нельзя.
import type { VireGlassSceneDrawer } from '@vire/vireglass/web';

export type Zone = { name: string; draw: VireGlassSceneDrawer };

type Grid = {
  base: string;
  line: string;
  accent: string;
  /** Шаг мелкой клетки в CSS-пикселях. */
  step: number;
  /** Каждая N-я линия — акцентная. */
  every: number;
};

function grid({ base, line, accent, step, every }: Grid): VireGlassSceneDrawer {
  return (ctx, w, h, offsetX, offsetY) => {
    const px = w / 360;
    const cell = step * px;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Линия шириной ровно в пиксель устройства и на полупиксельном смещении: иначе на
    // ретине она размазывается в две серые и перестаёт быть тонкой.
    const thin = Math.max(1, Math.round(px * 0.5));
    ctx.lineWidth = thin;

    // Сетка бесконечна: сдвиг берётся по модулю шага, поэтому полотно можно тянуть сколько
    // угодно и в любую сторону, не рисуя ничего за пределами кадра.
    const phase = (value: number, stride: number) => -(((value % stride) + stride) % stride);

    const draw = (span: number, limit: number, vertical: boolean, stride: number, color: string) => {
      const start = phase(vertical ? offsetX : offsetY, stride);
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let p = start; p <= limit + stride; p += stride) {
        const at = Math.round(p) + thin / 2;
        if (vertical) {
          ctx.moveTo(at, 0);
          ctx.lineTo(at, span);
        } else {
          ctx.moveTo(0, at);
          ctx.lineTo(span, at);
        }
      }
      ctx.stroke();
    };

    draw(h, w, true, cell, line);
    draw(w, h, false, cell, line);
    draw(h, w, true, cell * every, accent);
    draw(w, h, false, cell * every, accent);
  };
}

/** Телефонный кадр — стандартный размер экрана в CSS-пикселях, как у стенда: 360×800. */
export const PHONE = { width: 300, height: 640, gap: 44, radius: 34, top: 70, left: 60 };

/** Поле экрана. По нему выравнивается ВСЁ на телефоне — и стекло, и обычный контент: держать
 *  его в двух местах значит развести края деталей, которые стоят в столбик. */
export const SCREEN_MARGIN = 20;

/** Где стоит экран с номером `index` в координатах полотна, CSS-пиксели. */
export function phoneOrigin(index: number): { x: number; y: number } {
  return { x: PHONE.left + index * (PHONE.width + PHONE.gap), y: PHONE.top };
}

/** Путь экрана — общий для клипа фона и для обводки рамки, чтобы они совпадали пиксель в пиксель. */
export function phonePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Предложение фона приложения: глубокая тёмная база плюс цветная ДЫМКА. Дымка — не украшение,
 * а место, откуда стекло берёт цвет: над ровной заливкой материал нечем красить, и деталь
 * выходит серой независимо от того, что под ней.
 *
 * База не чёрная и не ровная: чистый чёрный не даёт линзе ничего преломлять, а плоская
 * заливка убивает подхват цвета кромкой. Оттенок дымки — параметр: в продукте он придёт от
 * обложки, поэтому фон обязан быть перекрашиваемым одним числом, а не набором готовых картинок.
 */
export function drawAppBackground(
  ctx: CanvasRenderingContext2D,
  density: number,
  index: number,
  offsetX: number,
  offsetY: number,
  hue: number,
): void {
  const px = density;
  const o = phoneOrigin(index);
  const x = o.x * px + offsetX;
  const y = o.y * px + offsetY;
  const width = PHONE.width * px;
  const height = PHONE.height * px;

  ctx.save();
  phonePath(ctx, x, y, width, height, PHONE.radius * px);
  ctx.clip();

  const base = ctx.createLinearGradient(x, y, x, y + height);
  base.addColorStop(0, '#12151b');
  base.addColorStop(0.55, '#0c0e13');
  base.addColorStop(1, '#07080b');
  ctx.fillStyle = base;
  ctx.fillRect(x, y, width, height);

  // Два пятна, а не одно: одиночное читается как виньетка, пара даёт направление и глубину.
  // Второй оттенок уведён по кругу — на одном тоне дымка выглядит подкрашенным светофильтром.
  const haze = (cx: number, cy: number, r: number, h: number, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `hsla(${h}, 70%, 55%, ${alpha})`);
    g.addColorStop(0.6, `hsla(${h}, 70%, 45%, ${alpha * 0.35})`);
    g.addColorStop(1, `hsla(${h}, 70%, 40%, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, width, height);
  };
  haze(x + width * 0.22, y + height * 0.18, width * 0.85, hue, 0.3);
  haze(x + width * 0.85, y + height * 0.62, width * 0.75, (hue + 55) % 360, 0.22);

  ctx.restore();
}

/**
 * ПРИТЕНЕНИЕ НИЗА — отдельным проходом ПОВЕРХ КОНТЕНТА, а не в фоне.
 *
 * Оно и раньше рисовалось, но в составе фона — то есть ПОД списком. Толку от этого не было
 * никакого: контент ложился сверху и приходил под панель управления в полную силу. На экране
 * это выглядело так, будто стекло перестало работать: заголовок трека шёл прямо сквозь ряд
 * навигации и между кнопками, где стекла нет вовсе и подавлять чужое нечем.
 *
 * Скрим — это НЕ работа материала. Материал отвечает за то, что видно СКВОЗЬ него; за то, что
 * лежит в зазорах между деталями, отвечает экран. Поэтому здесь и решается.
 */
export function drawFoot(
  ctx: CanvasRenderingContext2D,
  density: number,
  index: number,
  offsetX: number,
  offsetY: number,
): void {
  const px = density;
  const o = phoneOrigin(index);
  const x = o.x * px + offsetX;
  const y = o.y * px + offsetY;
  const width = PHONE.width * px;
  const height = PHONE.height * px;

  ctx.save();
  phonePath(ctx, x, y, width, height, PHONE.radius * px);
  ctx.clip();
  const foot = ctx.createLinearGradient(x, y + height * 0.7, x, y + height);
  foot.addColorStop(0, '#00000000');
  foot.addColorStop(0.55, '#000000a6');
  foot.addColorStop(1, '#000000e6');
  ctx.fillStyle = foot;
  ctx.fillRect(x, y + height * 0.7, width, height * 0.3);
  ctx.restore();
}

/**
 * Рамки телефонов поверх зоны: фон внутри остаётся тем же полотном, рамка только очерчивает
 * границы экрана. Иначе не увидеть, как деталь ведёт себя у края экрана и в его углу.
 */
export function drawPhoneFrames(
  ctx: CanvasRenderingContext2D,
  density: number,
  count: number,
  offsetX: number,
  offsetY: number,
): void {
  // Масштаб рамки — плотность экрана, а не доля ширины канваса: зоны меряют кегль долями
  // телефонного кадра, а рамка задана в CSS-пикселях и должна совпасть с деталями на ней.
  const px = density;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  for (let i = 0; i < count; i += 1) {
    const o = phoneOrigin(i);
    const x = o.x * px;
    const y = o.y * px;
    const width = PHONE.width * px;
    const height = PHONE.height * px;
    const radius = PHONE.radius * px;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();

    // Только контур: любая заливка внутри рамки подменяет фон, на котором и исследуют
    // материал, — экран обязан оставаться тем же полотном, что вокруг него.
    ctx.lineWidth = Math.max(1, Math.round(px));
    ctx.strokeStyle = '#8a97a870';
    ctx.stroke();

    // Вырез камеры залит чёрным, полоса жеста — светлым: это не фон экрана, а его железо и
    // системный элемент. Контурами они читались как разметка и терялись.
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(x + width / 2 - 34 * px, y + 10 * px, 68 * px, 20 * px, 10 * px);
    ctx.fill();
    ctx.fillStyle = '#eef1f5cc';
    ctx.beginPath();
    ctx.roundRect(x + width / 2 - 52 * px, y + height - 12 * px, 104 * px, 4 * px, 2 * px);
    ctx.fill();
  }
  ctx.restore();
}

export const ZONES: readonly Zone[] = [
  {
    name: 'светлая клетка',
    // Линии светлой сетки заметно темнее фона: при разнице в пару процентов стекло
    // размывает их в ровное молоко, и по кадру уже не судить, гнёт линза или нет.
    draw: grid({ base: '#e9ecf1', line: '#c6cdd8', accent: '#a9b3c2', step: 12, every: 5 }),
  },
  {
    name: 'тёмная клетка',
    draw: grid({ base: '#161a21', line: '#232935', accent: '#333b4a', step: 12, every: 5 }),
  },
] as const;

export const ZONE_NAMES: readonly string[] = ZONES.map((z) => z.name);
