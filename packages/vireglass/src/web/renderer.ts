// WebGL2-конвейер стенда `/rnd` (план, «Фаза 3»; спека §5). Четыре прохода, порядок и
// разбивка на слои повторяют Android намеренно — линза и поверхность НЕ схлопнуты в один
// проход, иначе стенд перестаёт предсказывать телефон (там это два разных слоя):
//
//   1. сцена-фон              — растеризуется в offscreen 2D-канвас (текст и обложки проще
//                                там, чем в GL) и заливается в текстуру `content`. Роль
//                                FBO(scene) из спеки играет эта текстура: последующие
//                                проходы её только СЭМПЛИРУЮТ, не перерисовывают.
//   2. блит фона на экран      — `content` рисуется как задник; без этого экран показывал бы
//                                только деталь, а материал сравнивают именно с тем, что рядом.
//   3. даунсемпл (`probe.ts`)  — статистика прямоугольника линзы, см. там.
//   4. линза (`toGLSL(LENS_SHADER)`)     — сэмплирует `content`, рисует поверх фона.
//   5. поверхность (`toGLSL(SURFACE_SHADER)`) — фаска и блик поверх линзы.
//
// ЕДИНИЦЫ. Всё — device-px, одно пространство координат на весь канвас (спека §4 п.2):
// `toLensProps` уже умножает на `density`, `toSurfaceUniforms` — нет и не должна (её контракт
// общий с Android), поэтому геометрические поля результата домножаются здесь.
//
// ОБЩИЙ ЦЕНТР. На Android линза и поверхность живут в СВОИХ локальных пространствах (разные
// запасы `lensPadDp`/`surfacePadDp`), концентричность — конвенция компонента. Здесь оба
// шейдера получают экранные координаты напрямую (`gl_FragCoord`), поэтому единственный
// способ свести их — передать в оба ОДИН И ТОТ ЖЕ `u_center` в пикселях канваса: линзе он
// приходит как есть (нативная уния), поверхности — подменяет значение адаптера (которое
// осмысленно только в её собственном локальном канвасе, здесь не существующем).
import {
  DYNAMIC_UNIFORMS,
  ICON_UNIFORMS,
  OVERLAY_UNIFORMS,
  toLensProps,
  toSurfaceUniforms,
  type VireGlassAccent,
  type VireGlassMorph,
  type VireGlassTouch,
} from '../adapters';
import { lensPadDp, surfacePadDp, type VireGlassGeometry } from '../geometry';
import { LENS_SHADER } from '../lens-shader';
import type { VireGlassDebugMode, VireGlassOptics } from '../material';
import { SURFACE_SHADER } from '../surface-shader';
import { toGLSL } from '../targets/glsl';
import {
  bindTextureAt,
  createProgram,
  createTexture,
  drawFullscreenTriangle,
  FULLSCREEN_TRIANGLE_VERTEX_SOURCE,
} from './gl';
import { createProbe, type ProbeStats } from './probe';

/** Сцена рисует себя со сдвигом: линзы на кадре стоят, а полотно под ними ползёт — только так
 *  и видно, что именно делает преломление с тем, что попадает под деталь. Сдвиг в device-px. */
export type VireGlassSceneDrawer = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
) => void;

/** Одна стеклянная деталь на кадре. Материал у каждой свой — так их и сравнивают рядом. */
export type VireGlassPiece = {
  optics: VireGlassOptics;
  geometry: VireGlassGeometry;
  /** Центр детали в ПИКСЕЛЯХ КАНВАСА (device-px). Общий для линзы и поверхности. */
  centerX: number;
  centerY: number;
  morph?: VireGlassMorph;
  /** Третья форма того же тела: разрыв детали на части идёт двумя перемычками. */
  morph2?: VireGlassMorph;
  /** Локальный отклик на палец: точка касания, тяга, нажатие, волна. */
  touch?: VireGlassTouch;
  /** Отклик на нажатие, 0…1 — блик расцветает, тело чуть плотнеет. */
  press?: number;
  /** Деталь под пальцем, 0…1 — сильнее блик и подсветка кромки. */
  active?: number;
  /** Сыгранная доля, 0…1: активное состояние, заданное полем. Опущено — прогресса нет. */
  progress?: number;
  /** Рисовать ли на детали значок из общей маски кадра (см. `iconMask` в опциях кадра). */
  icon?: boolean;
  /** Рисовать ли на детали цветной слой кадра (см. `colorLayer`). */
  overlay?: boolean;
  /** Цвет значка в покое и в активном состоянии, RGBA 0…1. */
  inkIdle?: readonly number[];
  inkActive?: readonly number[];
  /** Направление ключевого света в плоскости экрана; по умолчанию — свет в покое. */
  light?: readonly [number, number];
  /** 0…1: появление детали нарастанием линзы (M 2:55). */
  appear?: number;
  /** Тонирование главного действия — цветное стекло, а не заливка. */
  accent?: VireGlassAccent;
};

export type VireGlassRenderOptions = {
  /** `devicePixelRatio` — единица дана аргументом, а не читается глобально, чтобы рендерер
   *  оставался тестируемым и не привязанным к конкретному окну. */
  density: number;
  debug: VireGlassDebugMode;
  pieces: readonly VireGlassPiece[];
  scene: VireGlassSceneDrawer;
  /** Сдвиг полотна под неподвижными деталями, device-px. */
  offsetX?: number;
  offsetY?: number;
  /**
   * Маска краски размером с канвас, координаты экранные, читается ЗЕЛЁНЫМ каналом. Белым по
   * ЧЁРНОМУ: сглаживание обязано жить в цвете, а не в альфе, иначе внутри штриха зелёный
   * держится единицей до самого края и границы значка рвутся.
   *
   * Спокойное основание под краской маска НЕ несёт и нести не должна: это свойство самого
   * материала (`legibility`), одинаковое по всей детали. Пока его подкладывало приложение,
   * у одной детали оно было, у другой нет, и объяснить разницу было нечем.
   */
  iconMask?: TexImageSource | null;
  /**
   * Цветной слой приложения размером с канвас, координаты экранные: обложка, миниатюра — всё,
   * что приложение кладёт НА стекло в цвете. Отдельно от маски краски, потому что та несёт один
   * канал и красится полярностью, а здесь цвет свой.
   *
   * Рисуется ВНУТРИ материала, на той же координате, что и краска: только так деформация
   * поверхности ведёт их вместе. Отдельным слоем поверх стекла при нажатии надпись тряслась, а
   * обложка стояла на месте.
   */
  colorLayer?: TexImageSource | null;
};

export type VireGlassRenderResult = {
  /** По замеру фона на деталь, в том же порядке, что `pieces`. */
  probes: readonly (ProbeStats | null)[];
};

export type VireGlassRenderer = {
  resize(widthPx: number, heightPx: number): void;
  render(options: VireGlassRenderOptions): VireGlassRenderResult;
  destroy(): void;
};

const BLIT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D u_content;
uniform vec2 u_resolution;
void main() {
  // Тот же флип Y, что делает транспайлер для линзы/поверхности (targets/glsl.ts):
  // content залит из 2D-канваса БЕЗ переворота, его V=0 — верхняя строка сцены. Здесь тот
  // же порядок, иначе фон и то, что через него преломляет линза, разъезжаются по вертикали.
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.y = 1.0 - uv.y;
  fragColor = texture(u_content, uv);
}
`;

type UniformValue = number | readonly number[];

function locationCache(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const cache = new Map<string, WebGLUniformLocation | null>();
  return (name: string): WebGLUniformLocation | null => {
    let loc = cache.get(name);
    if (loc === undefined) {
      loc = gl.getUniformLocation(program, name);
      cache.set(name, loc);
    }
    return loc;
  };
}

function setUniform(
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation | null,
  value: UniformValue,
): void {
  if (!loc) return;
  if (typeof value === 'number') {
    gl.uniform1f(loc, value);
    return;
  }
  switch (value.length) {
    case 1:
      gl.uniform1f(loc, value[0]);
      break;
    case 2:
      gl.uniform2f(loc, value[0], value[1]);
      break;
    case 3:
      gl.uniform3f(loc, value[0], value[1], value[2]);
      break;
    case 4:
      gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
      break;
    default:
      throw new Error(`vireglass/web: неподдержанный размер униформы (${value.length})`);
  }
}

/** Материал приезжает ОДНИМ каналом (спека §4 «Контракт униформ»): имя/размер/значение
 *  тремя параллельными массивами — раскладка ровно та, что раньше терялась Android Prop'ами. */
function applyChannel(
  gl: WebGL2RenderingContext,
  get: (name: string) => WebGLUniformLocation | null,
  names: readonly string[],
  sizes: readonly number[],
  values: readonly number[],
): void {
  let cursor = 0;
  for (let i = 0; i < names.length; i += 1) {
    const size = sizes[i];
    setUniform(gl, get(names[i]), values.slice(cursor, cursor + size));
    cursor += size;
  }
}

function applyObject(
  gl: WebGL2RenderingContext,
  get: (name: string) => WebGLUniformLocation | null,
  values: Record<string, UniformValue>,
): void {
  for (const name of Object.keys(values)) setUniform(gl, get(name), values[name]);
}

export function createVireGlassRenderer(canvas: HTMLCanvasElement): VireGlassRenderer {
  const context = canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    alpha: false,
    antialias: false,
  });
  if (!context) throw new Error('vireglass/web: WebGL2 недоступен');
  // Явная нессылочная типизация — иначе сужение `!context` не переживает замыкание вложенных
  // `function resize/render/destroy` ниже, и tsc считает `gl` снова `WebGL2RenderingContext | null`.
  const gl: WebGL2RenderingContext = context;

  const blitProgram = createProgram(gl, FULLSCREEN_TRIANGLE_VERTEX_SOURCE, BLIT_FRAGMENT_SOURCE);
  const lensProgram = createProgram(gl, FULLSCREEN_TRIANGLE_VERTEX_SOURCE, toGLSL(LENS_SHADER));
  const surfaceProgram = createProgram(
    gl,
    FULLSCREEN_TRIANGLE_VERTEX_SOURCE,
    toGLSL(SURFACE_SHADER),
  );
  const probe = createProbe(gl, FULLSCREEN_TRIANGLE_VERTEX_SOURCE);

  const blitLoc = locationCache(gl, blitProgram);
  const lensLoc = locationCache(gl, lensProgram);
  const surfaceLoc = locationCache(gl, surfaceProgram);

  let width = canvas.width;
  let height = canvas.height;

  let sceneCanvas = document.createElement('canvas');
  let sceneCtx = sceneCanvas.getContext('2d');
  if (!sceneCtx) throw new Error('vireglass/web: 2D-контекст сцены недоступен');

  // Сглаженная оценка фона на деталь: ключ — её место в списке pieces.
  const settled = new Map<number, ProbeStats>();
  /** Доля нового замера на кадр. Тот же порядок, что SETTLE на Android. */
  const SETTLE = 0.12;

  function settleStats(index: number, fresh: ProbeStats): ProbeStats {
    const prev = settled.get(index);
    if (!prev) {
      settled.set(index, fresh);
      return fresh;
    }
    const mix = (a: number, b: number) => a + (b - a) * SETTLE;
    const next: ProbeStats = {
      luma: mix(prev.luma, fresh.luma),
      busy: mix(prev.busy, fresh.busy),
      lo: mix(prev.lo, fresh.lo),
      hi: mix(prev.hi, fresh.hi),
      slopeX: mix(prev.slopeX, fresh.slopeX),
      slopeY: mix(prev.slopeY, fresh.slopeY),
      r: mix(prev.r, fresh.r),
      g: mix(prev.g, fresh.g),
      b: mix(prev.b, fresh.b),
    };
    settled.set(index, next);
    return next;
  }

  let contentTexture = createTexture(gl, {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  });

  // Маска значков — ОДНА на кадр, размером с канвас. Шейдер сэмплит её по экранной координате
  // пикселя (`u_center + p` и есть `xy`), поэтому значок каждой детали просто рисуется в маску
  // на своём месте: отдельная текстура на кнопку тут не нужна.
  const iconTexture = createTexture(gl, { width: 1, height: 1 });
  const colorTexture = createTexture(gl, { width: 1, height: 1 });
  gl.bindTexture(gl.TEXTURE_2D, iconTexture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    1,
    1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.bindTexture(gl.TEXTURE_2D, null);

  function resize(widthPx: number, heightPx: number): void {
    width = Math.max(1, Math.round(widthPx));
    height = Math.max(1, Math.round(heightPx));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);

    sceneCanvas = document.createElement('canvas');
    sceneCanvas.width = width;
    sceneCanvas.height = height;
    sceneCtx = sceneCanvas.getContext('2d');
    if (!sceneCtx) throw new Error('vireglass/web: 2D-контекст сцены недоступен');

    gl.deleteTexture(contentTexture);
    contentTexture = createTexture(gl, { width, height });
  }

  function render(options: VireGlassRenderOptions): VireGlassRenderResult {
    if (!sceneCtx) throw new Error('vireglass/web: рендерер не инициализирован (resize не вызван)');

    // 1. Сцена-фон: 2D-канвас проще для текста и «обложек» (задача, п. 3), а роль FBO(scene)
    // из плана играет сама текстура — дальше её только читают.
    sceneCtx.clearRect(0, 0, width, height);
    options.scene(sceneCtx, width, height, options.offsetX ?? 0, options.offsetY ?? 0);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (options.colorLayer) {
      gl.bindTexture(gl.TEXTURE_2D, colorTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, options.colorLayer);
    }
    if (options.iconMask) {
      gl.bindTexture(gl.TEXTURE_2D, iconTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, options.iconMask);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // 2. Фон на экран — задник, на котором видна деталь.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(blitProgram);
    bindTextureAt(gl, 0, contentTexture, blitProgram, 'u_content');
    setUniform(gl, blitLoc('u_resolution'), [width, height]);
    drawFullscreenTriangle(gl);

    const probes: (ProbeStats | null)[] = [];

    for (let index = 0; index < options.pieces.length; index += 1) {
      const piece = options.pieces[index];

      // 3. Даунсемпл + статистика прямоугольника ВИДИМОГО стекла (без запасов линзы/поверхности —
      // те же `glassWidth`/`glassHeight`, что уходят в toLensProps). Сетку снимает только первая
      // деталь: она общая на кадр, остальным нужен лишь свой прямоугольник из неё.
      const halfWidth = (piece.geometry.width * options.density) / 2;
      const halfHeight = (piece.geometry.height * options.density) / 2;
      const rect = {
        centerX: piece.centerX,
        centerY: piece.centerY,
        halfWidth,
        halfHeight,
      };
      const fresh =
        index === 0
          ? probe.sample(contentTexture, width, height, rect)
          : probe.statsFor(width, height, rect);
      // Оценка фона подъезжает к новому значению, а не прыгает к нему. На Android это делает
      // нативная вьюха (`GlassLensView.kt`, покадровый SETTLE), в вебе не делал никто: под
      // движущимся полотном плотность тела дёргалась за мгновенным замером, и на кадре это
      // читалось световыми артефактами.
      const stats = fresh ? settleStats(index, fresh) : null;
      probes.push(stats);
      // Restore viewport и вернуть привязку контентной текстуры — проход зонда переиспользует
      // TEXTURE0 и свою FBO, оставляет их отвязанными сам, но viewport меняет.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);

      gl.enable(gl.BLEND);
      // Премультиплайд-over: и линза, и поверхность отдают premultiplied alpha (см. `return
      // half4(half3(...) * alpha, alpha)` в обоих шейдерах).
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // Оба прохода рисуются полноэкранным треугольником, но деталь занимает малую часть
      // кадра: без ножниц ряд образцов множит стоимость на число деталей (на софтверном
      // рендерере headless это уводило кадр в секунды). Запас берётся с обеих сторон —
      // тень, фаска и сбор света выходят за габарит детали.
      // Капля морфа уезжает за габарит детали — её ход входит в запас, иначе ножницы срежут
      // хвост ровно там, где он и интересен.
      const reachOf = (m?: VireGlassMorph) =>
        m ? Math.hypot(m.offsetX, m.offsetY) + Math.max(m.width, m.height) / 2 + m.smoothing : 0;
      const morphReach = Math.max(reachOf(piece.morph), reachOf(piece.morph2));
      // Деформация поля уводит край детали за её габарит — тяга, размах волны и рост при
      // нажатии. Без этого слагаемого ножницы срезают ровно ту часть, ради которой тянут.
      const touchReach = piece.touch
        ? Math.hypot(piece.touch.pullX, piece.touch.pullY) +
          piece.touch.waveAmp * 2 +
          Math.max(piece.geometry.width, piece.geometry.height) * 0.05 * piece.touch.press
        : 0;
      const padPx =
        (lensPadDp(piece.geometry, piece.optics) + surfacePadDp(piece.geometry, 0) + morphReach + touchReach) *
        options.density;
      const left = Math.max(0, Math.floor(piece.centerX - halfWidth - padPx));
      const right = Math.min(width, Math.ceil(piece.centerX + halfWidth + padPx));
      const top = Math.max(0, Math.floor(height - (piece.centerY + halfHeight + padPx)));
      const bottom = Math.min(height, Math.ceil(height - (piece.centerY - halfHeight - padPx)));
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(left, top, Math.max(0, right - left), Math.max(0, bottom - top));

      // 4. Линза.
      gl.useProgram(lensProgram);
      bindTextureAt(gl, 0, contentTexture, lensProgram, 'content');
      setUniform(gl, lensLoc('u_contentSize'), [width, height]);
      setUniform(gl, lensLoc('u_resolution'), [width, height]);
      setUniform(gl, lensLoc('u_center'), [piece.centerX, piece.centerY]);
      // Запаса локальной вьюхи здесь нет (одно общее пространство координат) — `u_reach`
      // на Android ограничивал сбор адаптивного размытия краем ПАДДИНГА лизны-вьюхи; тут этой
      // границы нет, поэтому значение выбрано заведомо больше любого реального радиуса сбора,
      // чтобы условие `reach - length(p)` никогда не срабатывало раньше `u_contentMin/Max`.
      setUniform(gl, lensLoc('u_reach'), Math.max(width, height));
      setUniform(gl, lensLoc('u_contentMin'), [1, 1]);
      setUniform(gl, lensLoc('u_contentMax'), [width - 1, height - 1]);
      if (stats) {
        setUniform(gl, lensLoc('u_probeLuma'), stats.luma);
        setUniform(gl, lensLoc('u_probeBusy'), stats.busy);
        setUniform(gl, lensLoc('u_probeRange'), [stats.lo, stats.hi]);
        setUniform(gl, lensLoc('u_probeSlope'), [stats.slopeX, stats.slopeY]);
        setUniform(gl, lensLoc('u_probe'), [stats.r, stats.g, stats.b]);
      } else {
        // Зонд ещё не отчитался (первые кадр-два) — сентинел -1 держит шейдер на его
        // собственных point-сэмплах (см. комментарий в `lens-shader.ts`).
        setUniform(gl, lensLoc('u_probeLuma'), -1);
      }
      const lens = toLensProps(piece.optics, piece.geometry, options.density, {
        debug: options.debug,
        morph: piece.morph,
        morph2: piece.morph2,
        touch: piece.touch,
        progress: piece.progress,
        light: piece.light,
        appear: piece.appear,
        accent: piece.accent,
      });
      applyChannel(gl, lensLoc, lens.uniformNames, lens.uniformSizes, lens.uniformValues);
      drawFullscreenTriangle(gl);

      // 5. Поверхность — общий центр с линзой (см. комментарий в шапке файла), геометрические
      // поля адаптера домножены на плотность здесь: контракт `toSurfaceUniforms` — dp, общий
      // с Android, самому адаптеру трогать нельзя.
      gl.useProgram(surfaceProgram);
      const rawSurface = toSurfaceUniforms(piece.optics, piece.geometry, {
        debug: options.debug,
        morph: piece.morph,
        morph2: piece.morph2,
        bodyInLens: true,
        touch: piece.touch,
        progress: piece.progress,
        // Над текстом тень плотнее, над ровным фоном слабее (M 11:47): отрыв детали от
        // пёстрого контента держит именно она.
        shadow: stats ? 0.8 + Math.min(stats.busy * 6, 1.2) : 1,
        appear: piece.appear,
      });
      const d = options.density;
      applyObject(gl, surfaceLoc, {
        ...rawSurface,
        u_center: [piece.centerX, piece.centerY],
        u_halfSize: [rawSurface.u_halfSize[0] * d, rawSurface.u_halfSize[1] * d],
        u_corner: rawSurface.u_corner * d,
        u_bevel: rawSurface.u_bevel * d,
        u_morphOffset: [rawSurface.u_morphOffset[0] * d, rawSurface.u_morphOffset[1] * d],
        u_morphHalf: [rawSurface.u_morphHalf[0] * d, rawSurface.u_morphHalf[1] * d],
        u_morphCorner: rawSurface.u_morphCorner * d,
        u_morphK: rawSurface.u_morphK * d,
        u_morph2Offset: [rawSurface.u_morph2Offset[0] * d, rawSurface.u_morph2Offset[1] * d],
        u_morph2Half: [rawSurface.u_morph2Half[0] * d, rawSurface.u_morph2Half[1] * d],
        u_morph2Corner: rawSurface.u_morph2Corner * d,
        u_shadowReach: rawSurface.u_shadowReach * d,

        u_touch: [rawSurface.u_touch[0] * d, rawSurface.u_touch[1] * d],
        u_pull: [rawSurface.u_pull[0] * d, rawSurface.u_pull[1] * d],
        u_touchRadius: rawSurface.u_touchRadius * d,
        u_wave: [rawSurface.u_wave[0] * d, rawSurface.u_wave[1]],
      });
      // Динамика ворклета на Android (нажатие, активность, наклон) здесь приходит полями детали.
      setUniform(gl, surfaceLoc(DYNAMIC_UNIFORMS[0]), piece.press ?? 0);
      setUniform(gl, surfaceLoc(DYNAMIC_UNIFORMS[1]), piece.active ?? 0);
      const hasIcon = Boolean(piece.icon && options.iconMask);
      setUniform(gl, surfaceLoc(ICON_UNIFORMS[0]), hasIcon ? 1 : 0);
      // Масштаб 1: координата уже экранная, нормировку на размер делает сам сэмплер.
      setUniform(gl, surfaceLoc(ICON_UNIFORMS[1]), 1);
      setUniform(gl, surfaceLoc(ICON_UNIFORMS[2]), piece.inkIdle ?? [1, 1, 1, 1]);
      setUniform(gl, surfaceLoc(ICON_UNIFORMS[3]), piece.inkActive ?? [1, 1, 1, 1]);
      bindTextureAt(gl, 1, iconTexture, surfaceProgram, 'u_icon');
      setUniform(gl, surfaceLoc('u_iconSize'), hasIcon ? [width, height] : [1, 1]);
      const hasColor = Boolean(piece.overlay && options.colorLayer);
      setUniform(gl, surfaceLoc(OVERLAY_UNIFORMS[0]), hasColor ? 1 : 0);
      bindTextureAt(gl, 2, colorTexture, surfaceProgram, 'u_overlay');
      setUniform(gl, surfaceLoc('u_overlaySize'), hasColor ? [width, height] : [1, 1]);
      setUniform(gl, surfaceLoc('u_resolution'), [width, height]);
      drawFullscreenTriangle(gl);
    }
    gl.disable(gl.SCISSOR_TEST);

    return { probes };
  }

  function destroy(): void {
    probe.destroy();
    gl.deleteProgram(blitProgram);
    gl.deleteProgram(lensProgram);
    gl.deleteProgram(surfaceProgram);
    gl.deleteTexture(contentTexture);
    gl.deleteTexture(iconTexture);
    gl.deleteTexture(colorTexture);
  }

  return { resize, render, destroy };
}
