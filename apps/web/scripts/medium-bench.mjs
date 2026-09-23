#!/usr/bin/env node
/**
 * Замер стоимости среды (`src/medium` пакета vireuikit) поверх стекла — время кадра и,
 * если браузер даёт GPU-таймер-запросы, время GPU при 0/1/3/6 стеклянных поверхностях, на
 * живой среде и на статичной подложке для сравнения (спека фона, «Бюджет»: цена умножается на
 * число стёкол, а не платится один раз).
 *
 * headless Chromium без флагов не отдаёт EXT_disjoint_timer_query_webgl2 вовсе (гейт молчит,
 * GPU-время просто не приходит); `--enable-unsafe-swiftshader` включает расширение, но рендерит
 * софтверным SwiftShader — числа относительны ДРУГ ДРУГА в этом прогоне, не абсолютны как на
 * реальном GPU (см. предупреждение в конце вывода).
 *
 *   node scripts/medium-bench.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.RND_BASE ?? 'http://127.0.0.1:3000/rnd';
const VIEWPORT = { width: 360, height: 800 };
const SCALE = 3;
const GLASS_COUNTS = [0, 1, 3, 6];
// Индексы в ZONES (apps/web/rnd-src/scenes.ts): 1 — статичная тёмная клетка (8 фикс. зон + 8
// сверочных полотен предшествуют «среде», добавленной последней).
const SUBJECTS = [
  { label: 'статика (тёмная клетка)', zone: 1 },
  { label: 'среда (curl-noise)', zone: 16 },
];
const WARMUP_MS = 900;
const SAMPLE_FRAMES = 90;

async function measureOne(browser, zone, glass) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}?zone=${zone}&glass=${glass}&bench=1&ui=0`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="rnd-state"]', { timeout: 15000 });
  await page.waitForTimeout(WARMUP_MS);
  if (errors.length) {
    await page.close();
    throw new Error(`стенд упал (zone=${zone} glass=${glass}): ${errors[0]}`);
  }
  const meta = await page.evaluate(() => document.querySelector('[data-testid="rnd-state"]').textContent);
  const result = await page.evaluate(() => window.__vgBenchSample());
  await page.close();
  if (errors.length) throw new Error(`стенд упал (zone=${zone} glass=${glass}): ${errors[0]}`);
  return { ...result, meta };
}

function median(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round2(v) {
  return v === null ? null : Math.round(v * 100) / 100;
}

async function main() {
  const useGpuTimer = !process.argv.includes('--no-gpu-timer');
  // Софтверный растеризатор даёт числа, сравнимые только друг с другом. --real-gpu поднимает
  // видимое окно на железном GL: только эти числа сопоставимы с бюджетом устройства.
  const realGpu = process.argv.includes('--real-gpu');
  const browser = await chromium.launch({
    headless: !realGpu,
    // Полный Chromium в окружении не установлен, только headless-shell; на железном GL идём
    // через системный Edge — он тот же Chromium и даёт настоящий WebGL2.
    ...(realGpu ? { channel: 'msedge' } : {}),
    args: realGpu
      ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization']
      : useGpuTimer
        ? ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
        : [],
  });

  const rows = [];
  let gridInfo = null;
  for (const subject of SUBJECTS) {
    for (const glass of GLASS_COUNTS) {
      const { frames, gpu, meta } = await measureOne(browser, subject.zone, glass);
      if (subject.label.startsWith('среда') && !gridInfo) {
        const m = /сетка среды (\d+)×(\d+)/.exec(meta);
        if (m) gridInfo = { width: Number(m[1]), height: Number(m[2]) };
      }
      const gpuValues = gpu.filter((v) => v !== null);
      rows.push({
        подложка: subject.label,
        стёкол: glass,
        'кадр мс (медиана)': round2(median(frames)),
        'кадр мс (p90)': round2([...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.9)]),
        'GPU мс (медиана)': gpuValues.length ? round2(median(gpuValues)) : null,
        'GPU сэмплов': gpuValues.length,
      });
    }
  }
  await browser.close();

  console.table(rows);
  console.log(JSON.stringify(rows, null, 1));
  console.log(`кадров в сэмпле: ${SAMPLE_FRAMES}, прогрев: ${WARMUP_MS} мс, вьюпорт: ${VIEWPORT.width}×${VIEWPORT.height} @${SCALE}x = ${VIEWPORT.width * SCALE}×${VIEWPORT.height * SCALE} device-px`);
  if (gridInfo) {
    const cellW = (VIEWPORT.width * SCALE) / gridInfo.width;
    const cellH = (VIEWPORT.height * SCALE) / gridInfo.height;
    console.log(`сетка среды: ${gridInfo.width}×${gridInfo.height} (≈${cellW.toFixed(1)}×${cellH.toFixed(1)} device-px на ячейку)`);
  }
  if (realGpu) {
    console.log(
      'GPU-время снято на ЖЕЛЕЗНОМ WebGL2 (системный Edge, видимое окно). Кадр упирается в ' +
        'развёртку 60 Гц, поэтому судить надо по GPU-времени, а не по времени кадра. Это ' +
        'десктопный GPU: на телефон числа не переносятся, там свой замер.',
    );
  } else if (useGpuTimer) {
    console.log(
      'GPU-время снято через EXT_disjoint_timer_query_webgl2 на headless Chromium с ' +
        '--enable-unsafe-swiftshader — это ПРОГРАММНЫЙ рендерер, не реальный GPU; абсолютные ' +
        'миллисекунды не переносятся, показателен только относительный рост внутри прогона. ' +
        'Для абсолютных чисел: --real-gpu.',
    );
  }
}

await main();
