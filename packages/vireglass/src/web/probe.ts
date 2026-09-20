// Зонд светлоты фона под линзой — веб-аналог нативного захвата в ImageReader
// (`GlassLensView.kt`), см. спеку §5 и план, раздел «Фаза 3».
//
// Даунсемпл сцены в сетку 48×96 идёт GL-проходом (сэмплирует `content` в grid.ts-программе,
// см. `renderer.ts`), а ЧТЕНИЕ результата — здесь, через PBO с `fenceSync`: синхронный
// `readPixels` стопорит конвейер, наивный порт даёт рывки при перетаскивании ползунков.
//
// Отставание в кадр-два — не баг, а часть контракта (план, «Фаза 3»): читаем то, что GPU
// уже досчитал к прошлому кадру, а не ждём текущий.

import { bindTextureAt, createFramebuffer, createProgram, drawFullscreenTriangle } from './gl';

export const PROBE_GRID_WIDTH = 48;
export const PROBE_GRID_HEIGHT = 96;

/** Статистика прямоугольника линзы по одному замеру зонда. `null`, пока не набежал первый
 *  готовый кадр — шейдер в этом случае держится на `u_probeLuma = -1` (см. `lens-shader.ts`). */
export type ProbeStats = {
  luma: number;
  busy: number;
  lo: number;
  hi: number;
  slopeX: number;
  slopeY: number;
  r: number;
  g: number;
  b: number;
};

const DOWNSAMPLE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D u_content;
uniform vec2 u_contentSize;
uniform vec2 u_gridSize;

// Отображение ячейка → UV содержимого. НЕ соответствует видимому верху/низу канваса — это
// внутренний проход, его буфер никогда не показывается, только читается обратно на CPU той
// же формулой (см. rectStats ниже). Совпадение направления с блит-проходом не требуется.
void main() {
  vec2 uv = gl_FragCoord.xy / u_gridSize;
  vec3 sum = vec3(0.0);
  const int N = 5;
  vec2 block = u_contentSize / u_gridSize;
  vec2 origin = uv * u_contentSize;
  for (int y = 0; y < N; y++) {
    for (int x = 0; x < N; x++) {
      vec2 p = origin + (vec2(float(x), float(y)) + 0.5) * (block / float(N));
      sum += texture(u_content, p / u_contentSize).rgb;
    }
  }
  fragColor = vec4(sum / float(N * N), 1.0);
}
`;

type PboSlot = {
  buffer: WebGLBuffer;
  sync: WebGLSync | null;
  pending: boolean;
};

export type ProbeRect = { centerX: number; centerY: number; halfWidth: number; halfHeight: number };

export type Probe = {
  /** Рендерит даунсемпл текущего содержимого `contentTexture` в свою FBO и продвигает
   *  конвейер чтения PBO. Возвращает статистику прямоугольника линзы — с отставанием
   *  в кадр-два, или `null`, пока ни один читатель не готов. */
  sample(
    contentTexture: WebGLTexture,
    contentWidth: number,
    contentHeight: number,
    rect: ProbeRect,
  ): ProbeStats | null;
  /** Статистика ещё одного прямоугольника по УЖЕ снятой сетке — без нового прохода и чтения. */
  statsFor(contentWidth: number, contentHeight: number, rect: ProbeRect): ProbeStats | null;
  destroy(): void;
};

/** RGBA32F даёт зонду субпиксельную точность усреднения (спека §5: «где веб сильнее») —
 *  без него сумма 25 восьмибитных отсчётов на ячейку требантуется обратно в 8 бит и слайс
 *  почти-чёрного градиента бандит уже на этом шаге. Без `EXT_color_buffer_float` откатываемся
 *  на RGBA8 — рендерится везде, просто грубее. */
function pickDownsampleFormat(
  gl: WebGL2RenderingContext,
): { internalFormat: number; type: number; floatPrecision: boolean } {
  const hasFloat = gl.getExtension('EXT_color_buffer_float') !== null;
  return hasFloat
    ? { internalFormat: gl.RGBA32F, type: gl.FLOAT, floatPrecision: true }
    : { internalFormat: gl.RGBA8, type: gl.UNSIGNED_BYTE, floatPrecision: false };
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Статистика прямоугольника по буферу 48×96. Строка `r` буфера — это `(r+0.5)/H` по той же
 * формуле, что в `DOWNSAMPLE_FRAGMENT_SOURCE`; здесь та же формула инвертируется, поэтому
 * ориентация буфера (вверх/вниз) неважна — важна лишь симметрия чтения и записи.
 */
type DownsampleBuffer = Float32Array | Uint8Array;

function rectStats(
  buffer: DownsampleBuffer,
  floatPrecision: boolean,
  gridW: number,
  gridH: number,
  contentWidth: number,
  contentHeight: number,
  rect: ProbeRect,
): ProbeStats | null {
  const x0 = rect.centerX - rect.halfWidth;
  const x1 = rect.centerX + rect.halfWidth;
  const y0 = rect.centerY - rect.halfHeight;
  const y1 = rect.centerY + rect.halfHeight;

  const lumas: number[] = [];
  const nx: number[] = [];
  const ny: number[] = [];
  let sr = 0;
  let sg = 0;
  let sb = 0;

  const norm = floatPrecision ? 1 : 255;
  for (let row = 0; row < gridH; row++) {
    const cy = ((row + 0.5) / gridH) * contentHeight;
    if (cy < y0 || cy > y1) continue;
    for (let col = 0; col < gridW; col++) {
      const cx = ((col + 0.5) / gridW) * contentWidth;
      if (cx < x0 || cx > x1) continue;
      const i = (row * gridW + col) * 4;
      const r = buffer[i] / norm;
      const g = buffer[i + 1] / norm;
      const b = buffer[i + 2] / norm;
      lumas.push(luma(r, g, b));
      nx.push((cx - rect.centerX) / Math.max(rect.halfWidth, 1));
      ny.push((cy - rect.centerY) / Math.max(rect.halfHeight, 1));
      sr += r;
      sg += g;
      sb += b;
    }
  }
  const n = lumas.length;
  if (n === 0) return null;

  let mean = 0;
  for (const v of lumas) mean += v;
  mean /= n;

  let busy = 0;
  for (const v of lumas) busy += Math.abs(v - mean);
  busy = (busy / n) * 2;

  const sorted = [...lumas].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  const slope = (xs: number[]) => {
    let mx = 0;
    for (const v of xs) mx += v;
    mx /= n;
    let sxx = 0;
    let sxl = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      sxx += dx * dx;
      sxl += dx * (lumas[i] - mean);
    }
    return sxx > 1e-6 ? sxl / sxx : 0;
  };

  return {
    luma: mean,
    busy: Math.min(busy, 1),
    lo: percentile(0.1),
    hi: percentile(0.9),
    slopeX: slope(nx),
    slopeY: slope(ny),
    r: sr / n,
    g: sg / n,
    b: sb / n,
  };
}

export function createProbe(gl: WebGL2RenderingContext, vertexSource: string): Probe {
  const program = createProgram(gl, vertexSource, DOWNSAMPLE_FRAGMENT_SOURCE);
  const format = pickDownsampleFormat(gl);

  const texture = gl.createTexture();
  if (!texture) throw new Error('vireglass/web/probe: gl.createTexture вернул null');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    format.internalFormat,
    PROBE_GRID_WIDTH,
    PROBE_GRID_HEIGHT,
    0,
    gl.RGBA,
    format.type,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const fbo = createFramebuffer(gl, texture);

  const byteSize = PROBE_GRID_WIDTH * PROBE_GRID_HEIGHT * 4 * (format.floatPrecision ? 4 : 1);
  const slots: PboSlot[] = [0, 1].map(() => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('vireglass/web/probe: gl.createBuffer вернул null');
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, byteSize, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return { buffer, sync: null, pending: false };
  });
  let cursor = 0;
  let latestRaw: DownsampleBuffer | null = null;

  const contentLoc = gl.getUniformLocation(program, 'u_content');
  const contentSizeLoc = gl.getUniformLocation(program, 'u_contentSize');
  const gridSizeLoc = gl.getUniformLocation(program, 'u_gridSize');

  function pollReady(slot: PboSlot): void {
    if (!slot.pending || !slot.sync) return;
    // Флаг проталкивает очередь команд, иначе забор, поставленный после readPixels, может не
    // сработать вовсе. Ожидание при этом нулевое. WAIT_FAILED — не готовность: без отдельной
    // ветки он проваливался дальше и читал из PBO мусор.
    const status = gl.clientWaitSync(slot.sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    if (status === gl.TIMEOUT_EXPIRED || status === gl.WAIT_FAILED) return;
    gl.deleteSync(slot.sync);
    slot.sync = null;
    slot.pending = false;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.buffer);
    const out: DownsampleBuffer = format.floatPrecision
      ? new Float32Array(PROBE_GRID_WIDTH * PROBE_GRID_HEIGHT * 4)
      : new Uint8Array(PROBE_GRID_WIDTH * PROBE_GRID_HEIGHT * 4);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    latestRaw = out;
  }

  function sample(
    contentTexture: WebGLTexture,
    contentWidth: number,
    contentHeight: number,
    rect: ProbeRect,
  ): ProbeStats | null {
    // Собрать готовые чтения ПРОШЛЫХ кадров, прежде чем заказывать новое.
    for (const slot of slots) pollReady(slot);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, PROBE_GRID_WIDTH, PROBE_GRID_HEIGHT);
    gl.useProgram(program);
    bindTextureAt(gl, 0, contentTexture, program, 'u_content');
    gl.uniform1i(contentLoc, 0);
    gl.uniform2f(contentSizeLoc, contentWidth, contentHeight);
    gl.uniform2f(gridSizeLoc, PROBE_GRID_WIDTH, PROBE_GRID_HEIGHT);
    gl.disable(gl.BLEND);
    drawFullscreenTriangle(gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const slot = slots[cursor];
    cursor = (cursor + 1) % slots.length;
    if (!slot.pending) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.buffer);
      gl.readPixels(0, 0, PROBE_GRID_WIDTH, PROBE_GRID_HEIGHT, gl.RGBA, format.type, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      slot.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      slot.pending = true;
    }

    return statsFor(contentWidth, contentHeight, rect);
  }

  // Даунсемпл — один на кадр, а деталей на кадре может быть много: каждой нужна статистика
  // СВОЕГО прямоугольника из той же сетки, а не собственный проход и собственное чтение PBO.
  function statsFor(contentWidth: number, contentHeight: number, rect: ProbeRect): ProbeStats | null {
    if (!latestRaw) return null;
    return rectStats(
      latestRaw,
      format.floatPrecision,
      PROBE_GRID_WIDTH,
      PROBE_GRID_HEIGHT,
      contentWidth,
      contentHeight,
      rect,
    );
  }

  function destroy(): void {
    for (const slot of slots) {
      if (slot.sync) gl.deleteSync(slot.sync);
      gl.deleteBuffer(slot.buffer);
    }
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
  }

  return { sample, statsFor, destroy };
}
