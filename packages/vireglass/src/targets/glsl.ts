// Цель WebGL2. Переводит тот же AGSL-текст (SDF + тело, см. `targets/agsl.ts`) в GLSL ES 3.0.
// Правила из docs/superpowers/specs/2026-09-04-vireglass-web-core.md §4 — каждое отдельной
// функцией, каждая со своим тестом в `__tests__/targets.test.ts`. Три места НЕ механические
// (там же в спеке): начало координат, единицы измерения (решаются в web-рендерере фазы 3,
// не здесь) и фильтрация семплера (тоже фаза 3). Здесь — только текст.

/**
 * Имя униформы с размером сэмплера для перевода `NAME.eval(coord)` → `texture(NAME, coord / SIZE)`.
 * Новая униформа — аналога в AGSL нет: у `.eval()` размер известен шейдеру неявно, у GLSL
 * `texture()` координата обязана быть нормированной. Одна на каждый `uniform shader`/
 * `uniform sampler2D`, имя выводится из имени сэмплера, а не хардкодится.
 */
function sizeUniformName(sampler: string): string {
  return sampler.startsWith('u_') ? `${sampler}Size` : `u_${sampler}Size`;
}

/** float2/float3/float4 → vec2/vec3/vec4. */
export function convertVecTypes(src: string): string {
  return src.replace(/\bfloat([234])\b/g, 'vec$1');
}

/** half/half2/half3/half4 → float/vec2/vec3/vec4, включая касты half(x) → float(x). */
export function convertHalfTypes(src: string): string {
  return src.replace(/\bhalf([234])\b/g, 'vec$1').replace(/\bhalf\b/g, 'float');
}

/** `uniform shader NAME;` → `uniform sampler2D NAME;` + новая `uniform vec2 <sizeUniform>;`. */
export function convertShaderUniforms(src: string): string {
  return src.replace(/uniform\s+shader\s+(\w+)\s*;/g, (_match, name: string) => {
    return `uniform sampler2D ${name};\nuniform vec2 ${sizeUniformName(name)};`;
  });
}

/**
 * `NAME.eval(coord)` → `texture(NAME, (coord) / <sizeUniform>)` для каждого объявленного
 * `uniform sampler2D`. Границы `coord` ищутся сканом скобок, а не регекспом: аргументы —
 * вложенные вызовы (`content.eval(vgInContent(s + dR - e))`), с запятыми и скобками внутри.
 */
export function convertEvalCalls(src: string): string {
  const samplers = new Set<string>();
  const declRe = /uniform\s+sampler2D\s+(\w+)\s*;/g;
  for (let m = declRe.exec(src); m; m = declRe.exec(src)) samplers.add(m[1]);
  if (samplers.size === 0) return src;

  const callRe = /(\w+)\.eval\(/g;
  let out = '';
  let cursor = 0;
  for (let m = callRe.exec(src); m; m = callRe.exec(src)) {
    const name = m[1];
    if (!samplers.has(name)) continue;
    const argStart = m.index + m[0].length;
    let depth = 1;
    let i = argStart;
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') depth -= 1;
      i += 1;
    }
    const args = src.slice(argStart, i - 1);
    out += src.slice(cursor, m.index);
    out += `texture(${name}, (${args}) / ${sizeUniformName(name)})`;
    cursor = i;
    callRe.lastIndex = i;
  }
  out += src.slice(cursor);
  return out;
}

/**
 * Ранние `return <выражение>;` внутри `main` → `fragColor = <выражение>; return;`. Принимает
 * ТОЛЬКО тело main (см. `convertEntryPoint`) — обычные `return` в вспомогательных функциях
 * лежат вне этого текста и не задеваются. Выражения без `;` внутри себя (в шейдерах их нет —
 * единственный `;` живёт в `for(...)`, а это не return), поэтому `[^;]+` безопасен.
 */
export function convertReturns(mainBody: string): string {
  return mainBody.replace(/\breturn\s+([^;]+);/g, 'fragColor = $1; return;');
}

const ENTRY_RE = /half4\s+main\s*\(\s*float2\s+(\w+)\s*\)\s*\{/;

/**
 * `half4 main(float2 xy) { ... }` → `void main() { vec2 xy = <координата с флипом Y>; ...; }`.
 * AGSL отдаёт `xy` в пикселях экрана слева-сверху, y вниз; `gl_FragCoord` — слева-снизу, y
 * вверх. Флип через `u_resolution.y - gl_FragCoord.y` восстанавливает исходную конвенцию
 * (обе системы координат — с центром пикселя `+0.5`, поэтому сдвига по X и константы не нужно).
 * `out vec4 fragColor` и `uniform vec2 u_resolution` объявляются в прологе (`addPrologue`).
 */
export function convertEntryPoint(src: string): string {
  const match = ENTRY_RE.exec(src);
  if (!match) {
    throw new Error('vireglass/targets/glsl: entry point "half4 main(float2 xy)" not found');
  }
  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let i = bodyStart;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') depth -= 1;
    i += 1;
  }
  const bodyEnd = i - 1;
  const param = match[1];
  const body = convertReturns(src.slice(bodyStart, bodyEnd));
  const head = src.slice(0, match.index);
  const tail = src.slice(i);
  return (
    `${head}void main() {\n` +
    `  vec2 ${param} = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);\n` +
    `${body}}${tail}`
  );
}

/** `#version 300 es` + `precision highp float;` — аналога в AGSL нет, WebGL2 требует их первыми
 *  строками файла. `out vec4 fragColor` и `uniform vec2 u_resolution` едут тут же: обе новые,
 *  без аналога в исходнике, и нужны ровно одной точке входа (`convertEntryPoint`). */
export function addPrologue(src: string): string {
  return (
    '#version 300 es\n' +
    'precision highp float;\n\n' +
    'out vec4 fragColor;\n' +
    'uniform vec2 u_resolution;\n\n' +
    src
  );
}

/** Полный перевод AGSL/SkSL → GLSL ES 3.0. Порядок: entry point ищется по литеральной
 *  AGSL-сигнатуре ДО конвертации типов, иначе `half4 main(float2 xy)` не найти. */
export function toGLSL(shaderSource: string): string {
  let out = shaderSource;
  out = convertEntryPoint(out);
  out = convertShaderUniforms(out);
  out = convertEvalCalls(out);
  out = convertVecTypes(out);
  out = convertHalfTypes(out);
  out = addPrologue(out);
  return out;
}
