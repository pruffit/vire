#!/usr/bin/env node
/**
 * Проверка транспайлера AGSL → GLSL (`../src/targets/glsl.ts`): поднимает headless-chromium,
 * компилирует оба фрагментных шейдера (линза, поверхность) в реальном WebGL2-контексте и
 * печатает getShaderInfoLog/getProgramInfoLog при ошибке. Вершинный шейдер — тривиальный
 * полноэкранный треугольник без буферов, только gl_VertexID.
 *
 * Запуск: pnpm --filter @vire/vireglass check:glsl (или `tsx scripts/check-glsl.mjs` из пакета).
 */
import { chromium } from 'playwright';
import { LENS_SHADER, SURFACE_SHADER, toGLSL } from '../src/index.ts';

const VERTEX_SOURCE = `#version 300 es
const vec2 VG_CHECK_POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(VG_CHECK_POS[gl_VertexID], 0.0, 1.0);
}
`;

function compileCheck({ vertexSource, fragmentSource }) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return { contextOk: false };

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return {
      shader,
      ok: gl.getShaderParameter(shader, gl.COMPILE_STATUS),
      log: gl.getShaderInfoLog(shader) ?? '',
    };
  }

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);

  let linkOk = false;
  let linkLog = '';
  if (vertex.ok && fragment.ok) {
    const program = gl.createProgram();
    gl.attachShader(program, vertex.shader);
    gl.attachShader(program, fragment.shader);
    gl.linkProgram(program);
    linkOk = gl.getProgramParameter(program, gl.LINK_STATUS);
    linkLog = gl.getProgramInfoLog(program) ?? '';
  }

  return {
    contextOk: true,
    renderer: gl.getParameter(gl.RENDERER),
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    vertexOk: vertex.ok,
    vertexLog: vertex.log,
    fragmentOk: fragment.ok,
    fragmentLog: fragment.log,
    linkOk,
    linkLog,
  };
}

async function checkOne(page, label, fragmentSource) {
  const result = await page.evaluate(compileCheck, { vertexSource: VERTEX_SOURCE, fragmentSource });
  if (!result.contextOk) {
    console.error(`[${label}] WebGL2 недоступен в headless-браузере`);
    return false;
  }
  console.log(`[${label}] renderer: ${result.renderer}`);
  console.log(`[${label}] GLSL: ${result.shadingLanguageVersion}`);
  console.log(`[${label}] вершинный: ${result.vertexOk ? 'OK' : 'FAIL'}`);
  if (!result.vertexOk) console.error(result.vertexLog);
  console.log(`[${label}] фрагментный: ${result.fragmentOk ? 'OK' : 'FAIL'}`);
  if (!result.fragmentOk) console.error(result.fragmentLog);
  console.log(`[${label}] линковка: ${result.linkOk ? 'OK' : 'FAIL'}`);
  if (!result.linkOk && result.vertexOk && result.fragmentOk) console.error(result.linkLog);
  return result.vertexOk && result.fragmentOk && result.linkOk;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const lensOk = await checkOne(page, 'lens', toGLSL(LENS_SHADER));
  const surfaceOk = await checkOne(page, 'surface', toGLSL(SURFACE_SHADER));

  await browser.close();

  if (!lensOk || !surfaceOk) {
    console.error('check-glsl: есть шейдеры, которые не компилируются');
    process.exitCode = 1;
    return;
  }
  console.log('check-glsl: оба шейдера компилируются и линкуются без ошибок');
}

await main();
