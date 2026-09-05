// Низкоуровневые GL-хелперы конвейера: компиляция программ, текстуры, FBO, полноэкранный
// треугольник. Ничего не знает про VireGlass — это переиспользуемый слой поверх WebGL2.

/** Тот же приём, что в `scripts/check-glsl.mjs`: три вершины без буфера, индексация по
 *  `gl_VertexID`. Один вершинный шейдер годится для ВСЕХ проходов конвейера, потому что
 *  каждый фрагментный шейдер сам достаёт координату из `gl_FragCoord`. */
export const FULLSCREEN_TRIANGLE_VERTEX_SOURCE = `#version 300 es
const vec2 VG_POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(VG_POS[gl_VertexID], 0.0, 1.0);
}
`;

export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('vireglass/web: gl.createShader вернул null');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '(нет лога)';
    gl.deleteShader(shader);
    throw new Error(`vireglass/web: шейдер не скомпилировался:\n${log}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('vireglass/web: gl.createProgram вернул null');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '(нет лога)';
    gl.deleteProgram(program);
    throw new Error(`vireglass/web: программа не слинковалась:\n${log}`);
  }
  return program;
}

/** Рисует полноэкранный треугольник текущей программой. Атрибутов нет — вершины зашиты
 *  в шейдер, поэтому даже VAO не нужен. */
export function drawFullscreenTriangle(gl: WebGL2RenderingContext): void {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export type TextureOptions = {
  width: number;
  height: number;
  /** RGBA8 по умолчанию; float нужен зонду, если понадобится точность выше 8 бит. */
  internalFormat?: number;
  format?: number;
  type?: number;
};

/**
 * Текстура content/зонда: LINEAR на MIN и MAG, без мипмапов, CLAMP_TO_EDGE. У Skia `.eval`
 * билинейный по умолчанию — NEAREST развалит дисковый сбор на пиксельные ступени (спека §4).
 */
export function createTexture(gl: WebGL2RenderingContext, options: TextureOptions): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('vireglass/web: gl.createTexture вернул null');
  const internalFormat = options.internalFormat ?? gl.RGBA8;
  const format = options.format ?? gl.RGBA;
  const type = options.type ?? gl.UNSIGNED_BYTE;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    options.width,
    options.height,
    0,
    format,
    type,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function createFramebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('vireglass/web: gl.createFramebuffer вернул null');
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`vireglass/web: FBO неполон, статус ${status}`);
  }
  return fbo;
}

/** Единственный texture-юнит, который нужен любому проходу конвейера здесь — привязка
 *  без лишней бухгалтерии по слотам. */
export function bindTextureAt(
  gl: WebGL2RenderingContext,
  unit: number,
  texture: WebGLTexture,
  program: WebGLProgram,
  uniformName: string,
): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const loc = gl.getUniformLocation(program, uniformName);
  gl.uniform1i(loc, unit);
}
