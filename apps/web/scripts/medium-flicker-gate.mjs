#!/usr/bin/env node
/**
 * Гейт на мигание среды (`src/medium` пакета vireuikit): покадровая светлота 60 кадров подряд
 * и проверка знака приращения между соседними кадрами. Баг «проход, читающий свой прошлый кадр
 * из FBO, переворачивает поле по вертикали каждый шаг» (см. `targets/glsl.ts`) даёт смену знака
 * почти на КАЖДОМ кадре — у исправной среды смен около нуля. Средний по кадрам снимок и обычный
 * покадровый скриншот этот баг не ловят вовсе, только покадровый ряд значений.
 *
 * Снимай на живом GPU (`--real-gpu`): headless-рендерер в этом окружении рисует SwiftShader'ом
 * (см. предупреждение в `medium-bench.mjs`), у программного растеризатора свои артефакты и о
 * реальном мигании они ничего не говорят.
 *
 *   node scripts/medium-flicker-gate.mjs --real-gpu
 */
import { chromium } from 'playwright';

const BASE = process.env.RND_BASE ?? 'http://127.0.0.1:3000/rnd';
const VIEWPORT = { width: 360, height: 800 };
const SCALE = 3;
const ZONE = 16; // «среда» — тот же индекс, что в medium-bench.mjs
const WARMUP_MS = 900;
// Порог: у исправной среды флипов знака — единицы из полусотни, у сломанной — почти все.
// Половина запаса между «редкий шум» и «системный паттерн 30 Гц».
const FLIP_RATIO_LIMIT = 0.5;

async function main() {
  const realGpu = process.argv.includes('--real-gpu');
  const browser = await chromium.launch({
    headless: !realGpu,
    ...(realGpu ? { channel: 'msedge' } : {}),
    args: realGpu
      ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Состояние и амплитуда зафиксированы явно — воспроизводимый прогон, без случайности харнесса.
  await page.goto(`${BASE}?zone=${ZONE}&glass=0&playback=playing&bpm=128&amp=0.6&bench=1&ui=0`, {
    waitUntil: 'load',
  });
  await page.waitForSelector('[data-testid="rnd-state"]', { timeout: 15000 });
  await page.waitForTimeout(WARMUP_MS);
  if (errors.length) {
    await browser.close();
    throw new Error(`стенд упал: ${errors[0]}`);
  }

  const lumas = await page.evaluate(() => window.__vgLumaSample());
  await browser.close();
  if (errors.length) throw new Error(`стенд упал: ${errors[0]}`);

  const deltas = [];
  for (let i = 1; i < lumas.length; i += 1) deltas.push(lumas[i] - lumas[i - 1]);
  let flips = 0;
  let comparable = 0;
  for (let i = 1; i < deltas.length; i += 1) {
    if (deltas[i] === 0 || deltas[i - 1] === 0) continue;
    comparable += 1;
    if (Math.sign(deltas[i]) !== Math.sign(deltas[i - 1])) flips += 1;
  }
  const ratio = comparable > 0 ? flips / comparable : 0;

  console.log(`светлота (${lumas.length} кадров): ${lumas.map((v) => v.toFixed(4)).join(' ')}`);
  console.log(`смен знака приращения: ${flips} из ${comparable} (${(ratio * 100).toFixed(0)}%)`);
  if (!realGpu) {
    console.log(
      'ПРЕДУПРЕЖДЕНИЕ: снято на SwiftShader (headless без --real-gpu) — для окончательного ' +
        'вердикта прогони с --real-gpu.',
    );
  }
  if (ratio > FLIP_RATIO_LIMIT) {
    console.error(`ГЕЙТ ПРОВАЛЕН: среда мигает (${flips}/${comparable} смен знака приращения).`);
    process.exitCode = 1;
    return;
  }
  console.log('ГЕЙТ ПРОЙДЕН: покадрового мигания нет.');
}

await main();
