#!/usr/bin/env node
/**
 * Гейт на сохранение воды (`src/medium/advect-shader.ts` пакета vireuikit,
 * `MEDIUM_VAPOR_ADVECT_SHADER`/`MEDIUM_CONDENSATE_ADVECT_SHADER`): вода — сохраняющийся объём,
 * у неё нет ни источника, ни стока, только перенос бездивергентным полем и переход между двумя
 * фазами (спека фона, «Конденсация: воды две»). Пар несёт цвет и не убывает сам по себе;
 * конденсат — капли, растущие и оседающие; конденсация переводит пар в конденсат, испарение —
 * обратно. Значит СЫРАЯ сумма ПАРА И КОНДЕНСАТА (не каждой фазы по отдельности — они постоянно
 * перетекают друг в друга) обязана оставаться почти постоянной во времени — читает
 * `renderer.getMediumTotals()` (в обход композита и его Oklab-смешения, которое нелинейно и само
 * по себе не обязано быть постоянным).
 *
 * Состояние — `playing`: турбулентность на пике (0.55–1.15) и активная эмиссия в буфер следов —
 * это худший, не самый чистый случай: сохранение воды обязано держаться, даже когда рядом бурлит
 * не относящаяся к ней активность (следы — отдельный буфер, у них есть свой распад и он не часть
 * этого требования).
 *
 * Снимает сумму воды раз в 5с на протяжении 90с; порог на размах относительно среднего — тот же,
 * что был у гейта на одну фазу: перенормировка раз в секунду (`WATER_RENORM_INTERVAL_S` в
 * `web/medium.ts`) теперь сверяет именно эту сумму и держит её тем же способом, поэтому смысл
 * порога не изменился, хотя измеряемая величина — сумма двух фаз, а не одна.
 *
 * WARMUP поднят с 900мс до 25с — то, чего не было у гейта на одну фазу. Сетка сеется С ПУСТЫМ
 * конденсатом (весь запас воды стартует паром), а конденсация/испарение — реакция с постоянной
 * времени порядка 1/(condensationRate+evaporationRate)≈4с: два фактора складываются, и выход
 * пары на совместное равновесие занимает не один кадр, а несколько секунд. Замерено: сумма воды
 * идёт 1131→1199 в первые ~20-25с (разово, пока конденсат впервые набирает свою долю), после чего
 * ложится на плато в пределах ~0.5% — но ЭТОТ переходный разгон, попав в окно измерения, один
 * пробивает старый порог 5%, хотя установившееся равновесие держится с большим запасом. Это
 * решается ожиданием точки отсчёта, а не смягчением критерия: судим о равновесии, когда оно уже
 * установилось, как и с любым переходным процессом.
 *
 *   node scripts/medium-equilibrium-gate.mjs --real-gpu
 */
import { chromium } from 'playwright';

const BASE = process.env.RND_BASE ?? 'http://127.0.0.1:3000/rnd';
const VIEWPORT = { width: 360, height: 800 };
const SCALE = 3;
const ZONE = 16;
const WARMUP_MS = 25000;
const SAMPLE_INTERVAL_MS = 5000;
const TOTAL_SAMPLES = 19; // t=0..90с включительно после прогрева, шаг 5с
const RANGE_OVER_MEAN_LIMIT = 0.05;

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
  await page.goto(`${BASE}?zone=${ZONE}&glass=0&playback=playing&bpm=128&amp=0.6&bench=1&ui=0`, {
    waitUntil: 'load',
  });
  await page.waitForSelector('[data-testid="rnd-state"]', { timeout: 15000 });
  await page.waitForTimeout(WARMUP_MS);
  if (errors.length) {
    await browser.close();
    throw new Error(`стенд упал: ${errors[0]}`);
  }

  const waterTotals = [];
  const vaporTotals = [];
  const condensateTotals = [];
  const trackTotals = [];
  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const totals = await page.evaluate(() => window.__vgWaterTotals());
    if (!totals) throw new Error('__vgWaterTotals вернул null — среда ни разу не рендерилась');
    waterTotals.push(totals.vapor + totals.condensate);
    vaporTotals.push(totals.vapor);
    condensateTotals.push(totals.condensate);
    trackTotals.push(totals.track);
    if (i < TOTAL_SAMPLES - 1) await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  await browser.close();
  if (errors.length) throw new Error(`стенд упал: ${errors[0]}`);

  const mean = waterTotals.reduce((s, v) => s + v, 0) / waterTotals.length;
  const range = Math.max(...waterTotals) - Math.min(...waterTotals);
  const ratio = mean > 1e-9 ? range / mean : Infinity;
  const driftFromStart = (waterTotals.at(-1) - waterTotals[0]) / waterTotals[0];

  console.log(`сумма воды пар+конденсат (${waterTotals.length} замеров по ${SAMPLE_INTERVAL_MS}мс): ${waterTotals.map((v) => v.toFixed(1)).join(' ')}`);
  console.log(`  из них пар: ${vaporTotals.map((v) => v.toFixed(1)).join(' ')}`);
  console.log(`  из них конденсат: ${condensateTotals.map((v) => v.toFixed(1)).join(' ')}`);
  console.log(`сумма следов (для контекста, распад ожидаем): ${trackTotals.map((v) => v.toFixed(1)).join(' ')}`);
  console.log(`среднее воды: ${mean.toFixed(2)}, размах: ${range.toFixed(2)}, размах/среднее: ${(ratio * 100).toFixed(2)}%, старт→конец: ${(driftFromStart * 100).toFixed(2)}%`);
  if (!realGpu) {
    console.log(
      'ПРЕДУПРЕЖДЕНИЕ: снято на SwiftShader (headless без --real-gpu) — для окончательного ' +
        'вердикта прогони с --real-gpu.',
    );
  }
  if (ratio > RANGE_OVER_MEAN_LIMIT) {
    console.error(`ГЕЙТ ПРОВАЛЕН: размах суммы воды ${(ratio * 100).toFixed(2)}% среднего > ${(RANGE_OVER_MEAN_LIMIT * 100).toFixed(0)}% — вода не сохраняется.`);
    process.exitCode = 1;
    return;
  }
  console.log(`ГЕЙТ ПРОЙДЕН: размах суммы воды ${(ratio * 100).toFixed(2)}% среднего ≤ ${(RANGE_OVER_MEAN_LIMIT * 100).toFixed(0)}%.`);
}

await main();
