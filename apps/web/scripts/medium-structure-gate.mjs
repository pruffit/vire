#!/usr/bin/env node
/**
 * Гейт на сохранение структуры видов пара (`src/medium/advect-shader.ts` пакета vireuikit) —
 * мера, порог и его калибровка на `advectSpeed=26`: `docs/vireglass/benchmarks/2026-09-14-medium-cost.md`.
 *
 *   node scripts/medium-structure-gate.mjs --real-gpu
 *   node scripts/medium-structure-gate.mjs --real-gpu --advect-speed=6.5   # контрольный прогон
 */
import { chromium } from 'playwright';

const BASE = process.env.RND_BASE ?? 'http://127.0.0.1:3000/rnd';
// Состояние меряется отдельно: у покоя своя скорость течения, и деградация схемы на нём другая.
const PLAYBACK_STATES = ['idle', 'playing', 'paused', 'stopped'];
const VIEWPORT = { width: 360, height: 800 };
const SCALE = 3;
const ZONE_NAME = 'среда';
// Прогрев короткий (не 25с, как у равновесия) — здесь меряется сама деградация со старта.
const WARMUP_MS = 900;
const SAMPLE_INTERVAL_MS = 5000;
const TOTAL_SAMPLES = 19; // t=0..90с включительно после прогрева, шаг 5с
const END_OVER_START_LIMIT = 0.18;

function speciesContrast(grid) {
  const { data } = grid;
  const cells = data.length / 3;
  let sum = 0;
  for (let i = 0; i < cells; i += 1) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const mean = (r + g + b) / 3;
    sum += (Math.abs(r - mean) + Math.abs(g - mean) + Math.abs(b - mean)) / 3;
  }
  return sum / cells;
}

async function main() {
  const realGpu = process.argv.includes('--real-gpu');
  const advectSpeedArg = process.argv.find((a) => a.startsWith('--advect-speed='));
  const advectSpeed = advectSpeedArg ? advectSpeedArg.split('=')[1] : null;
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
  const playbackArg = process.argv.find((a) => a.startsWith('--playback='))?.split('=')[1];
  const playback = PLAYBACK_STATES.includes(playbackArg ?? '') ? playbackArg : 'playing';
  const speedQuery = advectSpeed ? `&advectSpeed=${advectSpeed}` : '';
  await page.goto(
    `${BASE}?zone=${encodeURIComponent(ZONE_NAME)}&glass=0&playback=${playback}&bpm=128&amp=0.6&bench=1&ui=0${speedQuery}`,
    { waitUntil: 'load' },
  );
  await page.waitForSelector('[data-testid="rnd-state"]', { timeout: 15000 });
  if (errors.length) {
    await browser.close();
    throw new Error(`стенд упал: ${errors[0]}`);
  }
  const meta = await page.evaluate(() => document.querySelector('[data-testid="rnd-state"]').textContent);
  const gotZone = /zone=\d+\(([^)]+)\)/.exec(meta)?.[1];
  if (gotZone !== ZONE_NAME) {
    await browser.close();
    throw new Error(`стенд открыл не ту зону: ждали "${ZONE_NAME}", получили "${gotZone ?? '?'}"`);
  }
  await page.waitForTimeout(WARMUP_MS);
  if (errors.length) {
    await browser.close();
    throw new Error(`стенд упал: ${errors[0]}`);
  }

  const contrasts = [];
  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const grid = await page.evaluate(() => window.__vgVaporGrid());
    if (!grid) throw new Error('__vgVaporGrid вернул null — среда ни разу не рендерилась');
    contrasts.push(speciesContrast(grid));
    if (i < TOTAL_SAMPLES - 1) await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  await browser.close();
  if (errors.length) throw new Error(`стенд упал: ${errors[0]}`);

  const start = contrasts[0];
  const end = contrasts.at(-1);
  const ratio = start > 1e-9 ? end / start : 0;

  console.log(`контраст видов пара (${contrasts.length} замеров по ${SAMPLE_INTERVAL_MS}мс, прогрев ${WARMUP_MS}мс): ${contrasts.map((v) => v.toFixed(4)).join(' ')}`);
  console.log(`после прогрева: ${start.toFixed(4)}, к концу (90с): ${end.toFixed(4)}, конец/старт: ${(ratio * 100).toFixed(1)}%`);
  if (!realGpu) {
    console.log(
      'ПРЕДУПРЕЖДЕНИЕ: снято на SwiftShader (headless без --real-gpu) — для окончательного ' +
        'вердикта прогони с --real-gpu.',
    );
  }
  if (ratio < END_OVER_START_LIMIT) {
    console.error(`ГЕЙТ ПРОВАЛЕН: контраст видов пара упал до ${(ratio * 100).toFixed(1)}% от значения после прогрева < ${(END_OVER_START_LIMIT * 100).toFixed(0)}% — структура выцветает.`);
    process.exitCode = 1;
    return;
  }
  console.log(`ГЕЙТ ПРОЙДЕН: контраст видов пара к концу — ${(ratio * 100).toFixed(1)}% от значения после прогрева ≥ ${(END_OVER_START_LIMIT * 100).toFixed(0)}%.`);
}

await main();
