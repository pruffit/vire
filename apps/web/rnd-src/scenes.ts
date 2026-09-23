// Два фона стенда: светлая и тёмная тонкая клетка. Клетка, а не заливка и не картинка —
// тонкая прямая линия показывает работу линзы честнее всего: любое искажение, увод или
// разрыв видно сразу. Ни один фон не доведён до чистого чёрного или белого: на крайних
// значениях материал выглядит хорошо слишком легко, и решения по ним принимать нельзя.
import type { VireGlassSceneDrawer } from 'vireglass/web';
import { drawReferenceScene } from '@vire/vireglass/web';
import { REFERENCE_SCENES } from '@vire/vireglass';

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
  return (ctx, w, h, offsetX, offsetY, density) => {
    // Масштаб полотна — тот же, что у деталей. Доля ширины канваса давала на десктопе клетку
    // впятеро крупнее телефонной, и деталь того же размера читалась совсем иначе, чем на
    // устройстве: сравнивать стенд с лабораторией было нечем.
    const px = density;
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

// Сцены ниже повторяют эталонные кадры (docs/vireglass/reference.md): на них стенд сравнивают
// с первоисточником кадр к кадру. Сдвиг полотна двигает сцену целиком.

/** Граница светлого и тёмного под деталью (M 2:32): видно, откуда кромка берёт фон. */
const horizon: VireGlassSceneDrawer = (ctx, w, h, ox, oy) => {
  const y = Math.round(h * 0.37 + oy);
  const top = ctx.createLinearGradient(0, 0, w, 0);
  top.addColorStop(0, '#bcc0cb');
  top.addColorStop(1, '#8b94a2');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, y);
  const bottom = ctx.createLinearGradient(0, y, w, h);
  bottom.addColorStop(0, '#47474d');
  bottom.addColorStop(1, '#1b1e24');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, y, w, h - y);
};

/** Тёмное полотно, свет из угла (M 2:38): кромочный свет — две противоположные дуги. */
const sideLight: VireGlassSceneDrawer = (ctx, w, h, ox, oy) => {
  ctx.fillStyle = '#0a0b0f';
  ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.9;
  const g = ctx.createRadialGradient(ox, h * 0.95 + oy, 0, ox, h * 0.95 + oy, r);
  g.addColorStop(0, '#ccd2ea');
  g.addColorStop(0.3, '#5d6272');
  g.addColorStop(1, '#0a0b0f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/** Оранжевый цветок на небе (M 2:52): насыщенный цвет у кромки и небо вокруг. */
const poppy: VireGlassSceneDrawer = (ctx, w, h, ox, oy) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b5c9b');
  sky.addColorStop(1, '#93bee5');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const u = Math.min(w, h);
  const flower = (cx: number, cy: number, s: number) => {
    ctx.strokeStyle = '#4c7a2c';
    ctx.lineWidth = u * 0.012 * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy + u * 0.04 * s);
    ctx.quadraticCurveTo(cx + u * 0.03 * s, cy + u * 0.4 * s, cx - u * 0.01, h);
    ctx.stroke();
    const petals: [number, number, number, number, number, string, string][] = [
      [-0.07, -0.01, 0.11, 0.07, -0.5, '#ffb24a', '#d4470e'],
      [0.06, -0.07, 0.1, 0.075, 0.35, '#ffc463', '#e3560b'],
      [0.0, 0.04, 0.12, 0.06, 0.08, '#ff9c40', '#b92a24'],
    ];
    for (const [dx, dy, rx, ry, rot, c0, c1] of petals) {
      const px = cx + dx * u * s;
      const py = cy + dy * u * s;
      const g = ctx.createRadialGradient(px, py - ry * u * s * 0.4, 0, px, py, rx * u * s);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, py, rx * u * s, ry * u * s, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  flower(w * 0.43 + ox, h * 0.3 + oy, 1);
  flower(w * 0.8 + ox, h * 0.22 + oy, 0.45);
};

/** Дюны (M 2:58): гребни с резкой границей света и тени — линия, которую линза гнёт. */
const dunes: VireGlassSceneDrawer = (ctx, w, h, ox, oy) => {
  ctx.fillStyle = '#e3cda8';
  ctx.fillRect(0, 0, w, h);
  const ridges: [number, number, number, string, string][] = [
    [0.12, 0.05, 1.3, '#ecd9b8', '#7d6446'],
    [0.3, 0.07, 0.9, '#e2c9a2', '#6a5237'],
    [0.5, 0.06, 1.6, '#ead3ae', '#76603f'],
    [0.72, 0.08, 1.1, '#d9bd94', '#5c4630'],
  ];
  for (const [yf, amp, freq, light, dark] of ridges) {
    const ridge = (x: number) =>
      h * yf + oy + Math.sin(((x - ox) / w) * Math.PI * 2 * freq + yf * 9) * h * amp;
    const g = ctx.createLinearGradient(0, h * (yf - amp), 0, h * (yf + amp + 0.2));
    g.addColorStop(0, light);
    g.addColorStop(0.45, light);
    g.addColorStop(0.5, dark);
    g.addColorStop(1, light);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, ridge(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
};

const PARAGRAPH = [
  'Стекло гнёт свет у самой кромки и оставляет',
  'середину спокойной. Под плашкой едет строка,',
  'и материал обязан сделать её тише надписи,',
  'которая лежит на нём самом. Размытие здесь',
  'не украшение, а способ убрать спор двух',
  'текстов за одно и то же место на экране.',
];

/** Абзац на светлом (M 11:47): Regular обязан приглушать чужой текст под собой. */
const paragraph: VireGlassSceneDrawer = (ctx, w, h, ox, oy) => {
  ctx.fillStyle = '#f2f2f5';
  ctx.fillRect(0, 0, w, h);
  const size = Math.round(h * 0.03);
  const lead = size * 1.45;
  ctx.fillStyle = '#1b1b1f';
  ctx.font = `500 ${size}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const start = ((oy % lead) + lead) % lead;
  const first = Math.floor(-oy / lead);
  for (let i = 0; start + i * lead < h + lead; i += 1) {
    const line = PARAGRAPH[(((first + i) % PARAGRAPH.length) + PARAGRAPH.length) % PARAGRAPH.length];
    ctx.fillText(line, w * 0.08 + ox, start + i * lead);
  }
};

/**
 * Дорожка под деталью (M 4:30, L 6:10) — мерная сцена: на полосе видно то, чего не показывает
 * сетка, как у самой кромки содержимое утягивает вдоль силуэта и раздувает.
 *
 * Толщина в dp, а не долей окна, как у прочих зон: деталь тоже фиксирована в dp, и замер не
 * должен зависеть от размера окна. 19 dp — те же 17% высоты капсулы, что у эталонной дорожки.
 */
const track: VireGlassSceneDrawer = (ctx, w, h, ox, oy) => {
  const dpr = window.devicePixelRatio || 1;
  const y = Math.round(h * 0.34 + oy);
  const thick = Math.round(19 * dpr);
  ctx.fillStyle = '#eceef2';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d2d6de';
  ctx.fillRect(0, y - thick / 2, w, thick);
  ctx.fillStyle = '#0a6fd8';
  ctx.fillRect(0, y - thick / 2, Math.max(0, Math.min(w, w * 0.42 + ox)), thick);
};

// Сверочные полотна живут в пакете и рисуются обоими стендами одинаково — только так снимок
// с Android сравним со снимком из веба, и только так гейт меряет то же, на что смотрит глаз.
const referenceZones: readonly Zone[] = REFERENCE_SCENES.map((scene) => ({
  name: scene.name,
  draw: (ctx, w, h, _ox, _oy, density) =>
    drawReferenceScene(ctx, scene, w, h, { density, fit: 'полотно' }),
}));

/** Второй путь подложки (`main.ts`) — GPU-проход пишет прямо в contentTexture, этот 2D-канвас
 *  не используется; в списке зон только затем, чтобы `?zone=` мог её выбрать. */
const mediumNoop: VireGlassSceneDrawer = () => {};

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
  { name: 'горизонт', draw: horizon },
  { name: 'свет сбоку', draw: sideLight },
  { name: 'мак на небе', draw: poppy },
  { name: 'дюны', draw: dunes },
  { name: 'абзац', draw: paragraph },
  { name: 'дорожка', draw: track },
  ...referenceZones,
  { name: 'среда', draw: mediumNoop },
];

export const ZONE_NAMES: readonly string[] = ZONES.map((z) => z.name);
