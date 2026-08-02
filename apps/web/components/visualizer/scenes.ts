export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Frame {
  width: number;
  height: number;
  /** Секунды с момента запуска визуализации. */
  time: number;
  /** Сглаженная громкость 0..1. */
  amp: number;
  accent: Rgb;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, frame: Frame): void;
}

const FALLBACK_ACCENT: Rgb = { r: 124, g: 92, b: 255 };
export const BASE_COLOR = 'rgb(9, 9, 12)';

export function parseAccent(color: string | null | undefined): Rgb {
  if (!color) return FALLBACK_ACCENT;
  const hex = color.trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return FALLBACK_ACCENT;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Поворот оттенка акцента — вся палитра сцены строится из одного цвета трека. */
export function rotateHue({ r, g, b }: Rgb, degrees: number): Rgb {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb((h + degrees / 360 + 1) % 1, Math.min(1, s * 1.25 + 0.25), Math.min(0.68, Math.max(0.42, l + 0.1)));
}

export function rgba({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn
    ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    : max === gn
      ? ((bn - rn) / d + 2) / 6
      : ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    const tn = (t + 1) % 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255 };
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function fadeTrail(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(9, 9, 12, ${alpha})`;
  ctx.fillRect(0, 0, width, height);
}

/** Линия рисуется дважды — широкая полупрозрачная и тонкая яркая: дешёвое свечение без shadowBlur. */
function glow(ctx: CanvasRenderingContext2D, color: Rgb, width: number, alpha: number, path: () => void): void {
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, alpha * 0.16);
  ctx.lineWidth = width * 3.5;
  ctx.beginPath();
  path();
  ctx.stroke();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  path();
  ctx.stroke();
}

/** Зеркальная симметрия вокруг центра — то, что делает картинку «сделанной», а не случайной. */
function kaleidoscope(ctx: CanvasRenderingContext2D, cx: number, cy: number, sectors: number, draw: (sector: number) => void): void {
  for (let i = 0; i < sectors; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * Math.PI * 2) / sectors);
    if (i % 2 === 1) ctx.scale(1, -1);
    ctx.translate(-cx, -cy);
    draw(i);
    ctx.restore();
  }
}

function coreGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: Rgb, alpha: number): void {
  const r = Math.max(1, radius);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.4, rgba(color, alpha * 0.25));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

interface Walker {
  x: number;
  y: number;
  angle: number;
  life: number;
  hue: number;
}

/** Фрактальное облако: блуждающие частицы копятся следами и зеркалятся — «Battery» из WMP. */
function bloomScene(): Scene {
  const sectors = 4 + 2 * Math.floor(Math.random() * 3);
  const walkerCount = 26 + Math.floor(Math.random() * 22);
  const curl = between(0.25, 0.8);
  const spread = between(0.7, 1.15);
  let walkers: Walker[] = [];
  let bounds = { width: 0, height: 0 };

  const spawn = (): Walker => ({
    x: bounds.width / 2,
    y: bounds.height / 2,
    angle: Math.random() * Math.PI * 2,
    life: 0,
    hue: between(-60, 60),
  });

  return {
    draw(ctx, { width, height, time, amp, accent }) {
      if (bounds.width !== width || bounds.height !== height) {
        bounds = { width, height };
        walkers = Array.from({ length: walkerCount }, spawn);
      }
      fadeTrail(ctx, width, height, 0.05);

      const cx = width / 2;
      const cy = height / 2;
      const step = Math.min(width, height) * 0.012 * (0.6 + amp * 1.5) * spread;
      const maxLife = 90 + amp * 40;

      kaleidoscope(ctx, cx, cy, sectors, () => {
        ctx.globalCompositeOperation = 'lighter';
        for (const w of walkers) {
          ctx.strokeStyle = rgba(rotateHue(accent, w.hue + time * 6), 0.12 + amp * 0.22);
          ctx.lineWidth = 1 + amp * 1.4;
          ctx.beginPath();
          ctx.moveTo(w.x, w.y);
          ctx.lineTo(w.x + Math.cos(w.angle) * step, w.y + Math.sin(w.angle) * step);
          ctx.stroke();
        }
      });

      for (const w of walkers) {
        w.x += Math.cos(w.angle) * step;
        w.y += Math.sin(w.angle) * step;
        w.angle += (Math.random() - 0.5) * curl + Math.sin(time * 0.7 + w.hue) * 0.05;
        w.life++;
        if (w.life > maxLife || w.x < 0 || w.y < 0 || w.x > width || w.y > height) {
          Object.assign(w, spawn(), { hue: w.hue });
        }
      }

      coreGlow(ctx, cx, cy, Math.min(width, height) * (0.08 + amp * 0.1), rotateHue(accent, time * 6), 0.5);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

/** Лучи из центра: длина и яркость идут от громкости, вся конструкция медленно вращается. */
function starburstScene(): Scene {
  const rays = 14 + Math.floor(Math.random() * 22);
  const spin = between(-0.35, 0.35);
  const jitter = between(0.05, 0.3);
  const taper = between(0.35, 0.85);

  return {
    draw(ctx, { width, height, time, amp, accent }) {
      fadeTrail(ctx, width, height, 0.3);
      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.hypot(width, height) / 2;

      for (let i = 0; i < rays; i++) {
        const base = (i / rays) * Math.PI * 2 + time * spin;
        const wave = Math.sin(time * 1.7 + i * 0.9);
        const length = reach * (taper + 0.3 * wave + amp * 0.45);
        const color = rotateHue(accent, i * (360 / rays) * 0.9 + time * 8);
        const bend = Math.sin(time * 0.8 + i) * jitter;
        glow(ctx, color, 1.2 + amp * 2.2, 0.14 + amp * 0.18, () => {
          ctx.moveTo(cx, cy);
          for (let s = 1; s <= 6; s++) {
            const p = s / 6;
            const angle = base + bend * p;
            ctx.lineTo(cx + Math.cos(angle) * length * p, cy + Math.sin(angle) * length * p);
          }
        });
      }

      coreGlow(ctx, cx, cy, Math.min(width, height) * (0.1 + amp * 0.14), rotateHue(accent, time * 8), 0.6);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

/** Ленты во всю ширину — спокойная «водная» сцена, контраст к взрывным. */
function ribbonsScene(): Scene {
  const bands = 4 + Math.floor(Math.random() * 5);
  const frequency = between(1.2, 3.2);
  const speed = between(0.4, 1.2);
  const steps = 90;

  return {
    draw(ctx, { width, height, time, amp, accent }) {
      fadeTrail(ctx, width, height, 0.14);

      for (let band = 0; band < bands; band++) {
        const offset = (band + 0.5) / bands;
        const swing = height * (0.1 + amp * 0.3) * (0.5 + Math.sin(band * 1.3) * 0.5);
        const color = rotateHue(accent, band * 34 + time * 7);
        glow(ctx, color, 2 + amp * 5, 0.16 + amp * 0.18, () => {
          for (let i = 0; i <= steps; i++) {
            const p = i / steps;
            const x = p * width;
            const y = height * offset
              + Math.sin(p * Math.PI * frequency + time * speed + band) * swing
              + Math.sin(p * Math.PI * frequency * 2.3 - time * speed * 0.7 + band) * swing * 0.4;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        });
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

/** Спираль: рукава, витки и направление разные при каждом появлении, дотягивается до краёв. */
function spiralScene(): Scene {
  const arms = 2 + Math.floor(Math.random() * 4);
  const turns = between(5, 11);
  const direction = Math.random() < 0.5 ? -1 : 1;
  const squash = between(0.72, 1);
  const wobble = between(0, 0.14);
  const steps = 180;

  return {
    draw(ctx, { width, height, time, amp, accent }) {
      fadeTrail(ctx, width, height, 0.3);
      const cx = width / 2;
      const cy = height / 2;
      const scale = (Math.hypot(width, height) / 2) * (0.72 + amp * 0.3);

      for (let arm = 0; arm < arms; arm++) {
        const color = rotateHue(accent, arm * 96 + time * 7);
        const phase = direction * time * 0.36 + (arm * Math.PI * 2) / arms;
        glow(ctx, color, 1.3 + amp * 2.4, 0.16 + amp * 0.16, () => {
          for (let i = 0; i <= steps; i++) {
            const p = i / steps;
            const angle = phase + p * Math.PI * turns;
            const radius = scale * Math.pow(p, 0.8) * (1 + wobble * Math.sin(p * 21 + time * 2.4));
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius * squash;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        });
      }

      coreGlow(ctx, cx, cy, Math.min(width, height) * (0.07 + amp * 0.12), rotateHue(accent, 20 + time * 7), 0.55);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

/** Фигуры Лиссажу под зеркалом — «Alchemy»: медленно перетекающая петля с симметрией. */
function latticeScene(): Scene {
  const a = 2 + Math.floor(Math.random() * 4);
  const b = a + 1 + Math.floor(Math.random() * 4);
  const sectors = 2 + 2 * Math.floor(Math.random() * 3);
  const steps = 220;

  return {
    draw(ctx, { width, height, time, amp, accent }) {
      fadeTrail(ctx, width, height, 0.28);
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * (0.34 + amp * 0.12);
      const ry = height * (0.34 + amp * 0.12);
      const delta = time * 0.22;

      kaleidoscope(ctx, cx, cy, sectors, (sector) => {
        const color = rotateHue(accent, sector * 48 + time * 9);
        glow(ctx, color, 1.1 + amp * 1.6, 0.12 + amp * 0.12, () => {
          for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const x = cx + Math.sin(a * t + delta) * rx;
            const y = cy + Math.sin(b * t) * ry;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        });
      });
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

/** Лава-лампа: светящиеся пятна на плавных траекториях, края кадра гасит виньетка. */
function plasmaScene(): Scene {
  const blobs = 4 + Math.floor(Math.random() * 4);
  const drift = between(0.14, 0.3);
  const spread = between(0.24, 0.34);

  return {
    draw(ctx, { width, height, time, amp, accent }) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = BASE_COLOR;
      ctx.fillRect(0, 0, width, height);

      const span = Math.max(width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < blobs; i++) {
        const k = i + 1;
        const x = width * (0.5 + spread * Math.sin(time * drift * k + i * 1.7));
        const y = height * (0.5 + spread * 0.94 * Math.cos(time * drift * 0.8 * k + i * 2.3));
        const radius = Math.max(1, span * (0.11 + 0.06 * Math.sin(time * 0.3 + i)) * (0.85 + amp * 0.5));
        const color = rotateHue(accent, i * 37 + time * 6);
        const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
        blob.addColorStop(0, rgba(color, 0.6 + amp * 0.28));
        blob.addColorStop(0.4, rgba(color, 0.18));
        blob.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = blob;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      ctx.globalCompositeOperation = 'source-over';
      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.12, width / 2, height / 2, Math.hypot(width, height) / 2);
      vignette.addColorStop(0, 'rgba(9, 9, 12, 0)');
      vignette.addColorStop(0.55, 'rgba(9, 9, 12, 0.3)');
      vignette.addColorStop(1, BASE_COLOR);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    },
  };
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  hue: number;
}

/** Разлёт из центра: чем громче, тем быстрее и толще следы. */
function particlesScene(): Scene {
  const count = 160 + Math.floor(Math.random() * 120);
  const spin = between(-0.25, 0.25);

  const spawn = (seed: number): Particle => ({
    angle: Math.random() * Math.PI * 2,
    radius: 0.02 + seed * 0.5,
    speed: between(0.35, 1.1),
    hue: between(-45, 45),
  });
  const particles: Particle[] = Array.from({ length: count }, () => spawn(Math.random()));

  return {
    draw(ctx, { width, height, time, amp, accent }) {
      fadeTrail(ctx, width, height, 0.16);
      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.hypot(width, height) / 2;

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const prev = p.radius;
        p.radius += p.speed * (0.004 + amp * 0.012);
        p.angle += spin * 0.004;
        if (p.radius > 1) {
          particles[i] = spawn(0);
          continue;
        }
        const color = rotateHue(accent, p.hue + time * 6);
        ctx.strokeStyle = rgba(color, 0.2 + p.radius * 0.8);
        ctx.lineWidth = 0.8 + p.radius * (2.4 + amp * 3.2);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(p.angle) * prev * reach, cy + Math.sin(p.angle) * prev * reach);
        ctx.lineTo(cx + Math.cos(p.angle) * p.radius * reach, cy + Math.sin(p.angle) * p.radius * reach);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

export type SceneFactory = () => Scene;

export const SCENE_FACTORIES: readonly SceneFactory[] = [
  bloomScene, starburstScene, ribbonsScene, spiralScene, latticeScene, plasmaScene, particlesScene,
];
