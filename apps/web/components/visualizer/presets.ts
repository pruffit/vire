export type VisualizerPreset = 'off' | 'spiral' | 'plasma' | 'particles';

export const VISUALIZER_PRESETS: ReadonlyArray<{ value: VisualizerPreset; label: string }> = [
  { value: 'off', label: 'Обложка' },
  { value: 'spiral', label: 'Спираль' },
  { value: 'plasma', label: 'Плазма' },
  { value: 'particles', label: 'Частицы' },
];

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Frame {
  width: number;
  height: number;
  /** Секунды с момента запуска сцены. */
  time: number;
  /** Сглаженная громкость 0..1. */
  amp: number;
  accent: Rgb;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, frame: Frame): void;
}

const FALLBACK_ACCENT: Rgb = { r: 124, g: 92, b: 255 };
const BASE = 'rgb(9, 9, 12)';

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

/** Поворот оттенка акцента — палитра сцены строится из одного цвета трека. */
export function rotateHue({ r, g, b }: Rgb, degrees: number): Rgb {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb((h + degrees / 360 + 1) % 1, Math.min(1, s * 1.1 + 0.15), Math.min(0.72, l + 0.12));
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

export function createScene(preset: Exclude<VisualizerPreset, 'off'>): Scene {
  if (preset === 'spiral') return spiralScene();
  if (preset === 'plasma') return plasmaScene();
  return particlesScene();
}

const SPIRAL_ARMS = 3;
const SPIRAL_STEPS = 200;

function spiralScene(): Scene {
  return {
    draw(ctx, { width, height, time, amp, accent }) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(9, 9, 12, 0.22)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = (Math.min(width, height) / 2.15) * (0.7 + amp * 0.34);

      ctx.globalCompositeOperation = 'lighter';
      for (let arm = 0; arm < SPIRAL_ARMS; arm++) {
        const color = rotateHue(accent, arm * 46);
        ctx.strokeStyle = rgba(color, 0.5);
        ctx.lineWidth = 1 + amp * 2.6;
        ctx.beginPath();
        const phase = time * 0.34 + (arm * Math.PI * 2) / SPIRAL_ARMS;
        for (let i = 0; i <= SPIRAL_STEPS; i++) {
          const p = i / SPIRAL_STEPS;
          const angle = phase + p * Math.PI * 6.5;
          const radius = scale * Math.pow(p, 0.82) * (1 + 0.07 * Math.sin(p * 19 + time * 2.2));
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius * 0.92;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      const coreRadius = scale * (0.16 + amp * 0.22);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, coreRadius));
      core.addColorStop(0, rgba(rotateHue(accent, 20), 0.55));
      core.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = core;
      ctx.fillRect(cx - coreRadius, cy - coreRadius, coreRadius * 2, coreRadius * 2);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const BLOBS = 6;

function plasmaScene(): Scene {
  return {
    draw(ctx, { width, height, time, amp, accent }) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = BASE;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'lighter';
      const span = Math.max(width, height);
      for (let i = 0; i < BLOBS; i++) {
        const k = i + 1;
        const x = width * (0.5 + 0.3 * Math.sin(time * 0.21 * k + i * 1.7));
        const y = height * (0.5 + 0.28 * Math.cos(time * 0.17 * k + i * 2.3));
        const radius = span * (0.11 + 0.06 * Math.sin(time * 0.3 + i)) * (0.85 + amp * 0.5);
        const color = rotateHue(accent, i * 37);
        const blob = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
        blob.addColorStop(0, rgba(color, 0.58 + amp * 0.26));
        blob.addColorStop(0.4, rgba(color, 0.16));
        blob.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = blob;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      // Виньетка: без неё сумма пятен даёт ровную светлую заливку до самых краёв кадра.
      ctx.globalCompositeOperation = 'source-over';
      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.12, width / 2, height / 2, Math.hypot(width, height) / 2);
      vignette.addColorStop(0, 'rgba(9, 9, 12, 0)');
      vignette.addColorStop(0.55, 'rgba(9, 9, 12, 0.35)');
      vignette.addColorStop(1, 'rgb(9, 9, 12)');
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

const PARTICLE_COUNT = 220;

function particlesScene(): Scene {
  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => spawn(Math.random()));

  function spawn(seed: number): Particle {
    return {
      angle: Math.random() * Math.PI * 2,
      radius: 0.02 + seed * 0.5,
      speed: 0.35 + Math.random() * 0.75,
      hue: Math.random() * 90 - 45,
    };
  }

  return {
    draw(ctx, { width, height, amp, accent }) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(9, 9, 12, 0.16)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.hypot(width, height) / 2;

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const prev = p.radius;
        p.radius += p.speed * (0.004 + amp * 0.012);
        if (p.radius > 1) {
          particles[i] = spawn(0);
          continue;
        }
        const color = rotateHue(accent, p.hue);
        const x1 = cx + Math.cos(p.angle) * prev * reach;
        const y1 = cy + Math.sin(p.angle) * prev * reach;
        const x2 = cx + Math.cos(p.angle) * p.radius * reach;
        const y2 = cy + Math.sin(p.angle) * p.radius * reach;
        ctx.strokeStyle = rgba(color, 0.2 + p.radius * 0.8);
        ctx.lineWidth = 0.8 + p.radius * (2.4 + amp * 3.2);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
