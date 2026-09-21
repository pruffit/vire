/**
 * Рисование сверочного полотна на канвасе. Живёт в `web/`, потому что знает про 2D-контекст;
 * сами полотна — данные в `reference-scene.ts`, и мобильная лаборатория кладёт те же данные
 * вьюхами.
 *
 * Тот же рисовальщик берёт и гейт `check:optics`: только так глаз на стенде и число в гейте
 * смотрят на одно полотно. Разница между ними одна — режим вписывания.
 */

import {
  REFERENCE_SCENE_HEIGHT,
  REFERENCE_SCENE_WIDTH,
  REFERENCE_SURROUND,
  refCheckerCells,
  refGradientSteps,
  refGray,
  refGridPositions,
  refStripePositions,
  type VireGlassRefLayer,
  type VireGlassRefScene,
} from '../reference-scene';

export type VireGlassRefDrawOptions = {
  /** Пикселей на dp. Та же величина, что у деталей: полотно и стекло обязаны жить в одном масштабе. */
  readonly density: number;
  /** Светлота полотна; полотна, которым она не нужна, её игнорируют. По умолчанию — своя. */
  readonly level?: number;
  /**
   * `полотно` — панель `REFERENCE_SCENE_WIDTH`×`REFERENCE_SCENE_HEIGHT` dp по центру площадки,
   * вокруг поле окружения: только так два стенда показывают ОДНО полотно, включая фазу узора
   * под деталью. `во весь кадр` — полосы растянуты на весь кадр: у гейта площадка своя и
   * постоянная, а поле окружения ему мешает снимать пиксели.
   */
  readonly fit?: 'полотно' | 'во весь кадр';
};

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: VireGlassRefLayer,
  x: number,
  y: number,
  w: number,
  h: number,
  d: number,
): void {
  switch (layer.kind) {
    case 'заливка': {
      ctx.fillStyle = refGray(layer.level);
      ctx.fillRect(x, y, w, h);
      return;
    }
    case 'полосы': {
      ctx.fillStyle = refGray(layer.level);
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = refGray(layer.other);
      for (const at of refStripePositions(layer, w / d)) {
        ctx.fillRect(x + at * d, y, layer.widthDp * d, h);
      }
      return;
    }
    case 'шахматка': {
      for (const cell of refCheckerCells(layer, w / d, h / d)) {
        ctx.fillStyle = refGray(cell.level);
        ctx.fillRect(x + cell.xDp * d, y + cell.yDp * d, layer.cellDp * d + 1, layer.cellDp * d + 1);
      }
      return;
    }
    case 'ступень': {
      ctx.fillStyle = refGray(layer.left);
      ctx.fillRect(x, y, w / 2, h);
      ctx.fillStyle = refGray(layer.right);
      ctx.fillRect(x + w / 2, y, w - w / 2, h);
      return;
    }
    case 'черта': {
      ctx.fillStyle = refGray(layer.level);
      ctx.fillRect(x, y, w, h);
      const t = layer.thicknessDp * d;
      ctx.fillStyle = refGray(layer.barLevel);
      ctx.fillRect(x, y + Math.round((h - t) / 2), w, t);
      return;
    }
    case 'сетка': {
      ctx.fillStyle = refGray(layer.level);
      ctx.fillRect(x, y, w, h);
      // Линия ровно в ОДИН пиксель устройства — столько же, сколько кладёт вьюха
      // (`StyleSheet.hairlineWidth`). Половина плотности давала на этом экране два пикселя
      // против одного, и полотна двух стендов расходились на самой тонкой детали сцены.
      const thin = 1;
      ctx.fillStyle = refGray(layer.lineLevel);
      for (const at of refGridPositions(layer.stepDp, w / d)) ctx.fillRect(x + Math.round(at * d), y, thin, h);
      for (const at of refGridPositions(layer.stepDp, h / d)) ctx.fillRect(x, y + Math.round(at * d), w, thin);
      return;
    }
    case 'градиент': {
      const steps = refGradientSteps(layer);
      const band = h / steps.length;
      for (let i = 0; i < steps.length; i += 1) {
        ctx.fillStyle = refGray(steps[i]);
        ctx.fillRect(x, y + Math.round(i * band), w, Math.ceil(band) + 1);
      }
      return;
    }
  }
}

export function drawReferenceScene(
  ctx: CanvasRenderingContext2D,
  scene: VireGlassRefScene,
  width: number,
  height: number,
  options: VireGlassRefDrawOptions,
): void {
  const d = options.density;
  const bands = scene.bands(options.level ?? scene.level);
  const fill = options.fit !== 'полотно';

  let x: number;
  let y: number;
  let w: number;
  let scale: number;
  if (fill) {
    x = 0;
    y = 0;
    w = width;
    scale = height / (REFERENCE_SCENE_HEIGHT * d);
  } else {
    ctx.fillStyle = REFERENCE_SURROUND;
    ctx.fillRect(0, 0, width, height);
    w = Math.round(REFERENCE_SCENE_WIDTH * d);
    x = Math.round((width - w) / 2);
    y = Math.round((height - REFERENCE_SCENE_HEIGHT * d) / 2);
    scale = 1;
  }

  for (const band of bands) {
    const h = Math.round(band.heightDp * d * scale);
    drawLayer(ctx, band.layer, x, y, w, h, d);
    y += h;
  }
}
