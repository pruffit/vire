import { rotateHue, SCENE_FACTORIES, type Frame, type Scene } from './scenes';

const SEGMENT_MIN_SEC = 16;
const SEGMENT_MAX_SEC = 30;
const FADE_SEC = 2.4;
/** Оттенок уезжает сам по себе: цвет не должен стоять на месте всю песню. */
const HUE_DRIFT_DEG_PER_SEC = 2.4;

interface Layer {
  scene: Scene;
  index: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface VisualizerEngine {
  draw(ctx: CanvasRenderingContext2D, frame: Frame, dpr: number): void;
  dispose(): void;
}

function createLayer(width: number, height: number, dpr: number, previousIndex: number): Layer | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const index = pickIndex(previousIndex);
  return { scene: SCENE_FACTORIES[index]!(), index, canvas, ctx };
}

// Та же форма подряд читается как «зависло».
function pickIndex(previousIndex: number): number {
  if (SCENE_FACTORIES.length < 2) return 0;
  const shift = 1 + Math.floor(Math.random() * (SCENE_FACTORIES.length - 1));
  return previousIndex < 0
    ? Math.floor(Math.random() * SCENE_FACTORIES.length)
    : (previousIndex + shift) % SCENE_FACTORIES.length;
}

/**
 * Одна непрерывная визуализация, а не набор режимов: формы сами сменяют друг друга каждые
 * 16–30 секунд с перетеканием, цвет всё время уезжает по кругу. Каждая сцена рисует в свой
 * буфер — иначе затухающие следы одной стирали бы другую во время перехода.
 */
export function createVisualizerEngine(): VisualizerEngine {
  let current: Layer | null = null;
  let incoming: Layer | null = null;
  let size = { width: 0, height: 0, dpr: 1 };
  let nextSwitchAt = 0;
  let fadeStartedAt = 0;

  function scheduleNext(time: number): void {
    nextSwitchAt = time + SEGMENT_MIN_SEC + Math.random() * (SEGMENT_MAX_SEC - SEGMENT_MIN_SEC);
  }

  function reset(width: number, height: number, dpr: number): void {
    size = { width, height, dpr };
    current = createLayer(width, height, dpr, -1);
    incoming = null;
  }

  return {
    draw(ctx, frame, dpr) {
      const { width, height, time, amp, bass, treble, beat, accent, palette } = frame;
      if (!current || size.width !== width || size.height !== height || size.dpr !== dpr) {
        reset(width, height, dpr);
        scheduleNext(time);
      }
      if (!current) return;

      const drifted = rotateHue(accent, time * HUE_DRIFT_DEG_PER_SEC);
      const sceneFrame: Frame = { width, height, time, amp, bass, treble, beat, accent: drifted, palette };

      if (!incoming && time >= nextSwitchAt) {
        incoming = createLayer(width, height, dpr, current.index);
        fadeStartedAt = time;
      }

      current.scene.draw(current.ctx, sceneFrame);
      const fade = incoming ? Math.min(1, (time - fadeStartedAt) / FADE_SEC) : 0;
      if (incoming) incoming.scene.draw(incoming.ctx, sceneFrame);

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1 - fade;
      ctx.drawImage(current.canvas, 0, 0, width, height);
      if (incoming) {
        ctx.globalAlpha = fade;
        ctx.drawImage(incoming.canvas, 0, 0, width, height);
      }
      ctx.globalAlpha = 1;

      if (incoming && fade >= 1) {
        current = incoming;
        incoming = null;
        scheduleNext(time);
      }
    },

    dispose() {
      current = null;
      incoming = null;
    },
  };
}
