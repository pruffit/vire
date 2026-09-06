#!/usr/bin/env node
/**
 * Гейт на ДВА ГЛАВНЫХ ОБЕЩАНИЯ МАТЕРИАЛА. Оба нарушались молча и жили сутками: шейдер
 * компилируется, тесты зелёные, а на экране плашка вместо стекла.
 *
 *   1. ОКНО. Деталь обязана пропускать то, что под ней. Над полосатым полотном размах яркости
 *      ВНУТРИ детали — заметная доля размаха снаружи.
 *   2. ПРЕДМЕТ. Деталь обязана быть видна над РОВНЫМ полотном, иначе элемент управления
 *      исчезает: тело или кромка отходят от фона.
 *
 * Проверка идёт ПО ВСЕМУ ДИАПАЗОНУ светлоты полотна, а не в паре точек. Дефект, ради которого
 * гейт и написан, был не порогом, а ОСОБЕННОСТЬЮ: требуемый отход делился на расстояние от
 * тинта до фона, и когда светлота фона проходила рядом с тинтом, частное улетало в клампу —
 * стекло становилось непрозрачным в узкой полосе значений и оставалось нормальным по краям.
 * Две контрольные точки такое пропускают, проход по диапазону — нет.
 *
 * Полярность на каждом шаге берётся ТА, ЧТО СТАВИТ АВТОМАТИКА (shouldInkBeLight): дефолтный
 * ink материала в продукте не встречается, а опасен именно реальный режим.
 *
 * Пороги, а не эталонный снимок: снимок ломается от любой правки оптики, обещание — только
 * когда оно действительно нарушено.
 *
 * Запуск: pnpm --filter @vire/vireglass check:optics
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = resolve(HERE, '../src/index.ts').replace(/\\/g, '/');
const WEB = resolve(HERE, '../src/web/index.ts').replace(/\\/g, '/');

/** Пропускание ниже этого — уже не окно: под стеклом не видно, что там лежит. */
const MIN_TRANSMISSION = 0.25;
/** Отход детали от ровного фона ниже этого — элемент управления не найти глазом. */
const MIN_PRESENCE = 5;
/** Шагов по светлоте полотна. Гуще, чем кажется нужным: особенность сидит там, где светлота
 *  полотна проходит рядом со светлотой тинта, и редкий шаг её перешагивает. */
const STEPS = 41;

const ENTRY = `
import { createVireGlassRenderer } from '${WEB}';
import {
  INK_DARK,
  INK_LIGHT,
  resolveOptics,
  roundedRectGeometry,
  shouldInkBeLight,
  VIREGLASS_MATERIAL,
} from '${CORE}';

const hex = (v) => {
  const b = Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0');
  return '#' + b + b + b;
};

let stage = null;

globalThis.vgProbe = ({ level, striped }) => {
  if (!stage) {
    const canvas = document.createElement('canvas');
    canvas.width = 520;
    canvas.height = 300;
    document.body.append(canvas);
    const renderer = createVireGlassRenderer(canvas);
    renderer.resize(canvas.width, canvas.height);
    stage = { canvas, renderer };
  }
  const { canvas, renderer } = stage;

  // Полосы шире фаски: их обязано гасить тело, а не кромка. Контраст полос одинаков на всех
  // уровнях, чтобы пропускание сравнивалось между шагами честно.
  const stripe = level < 0.5 ? level + 0.22 : level - 0.22;
  const scene = (ctx, w, h) => {
    ctx.fillStyle = hex(level);
    ctx.fillRect(0, 0, w, h);
    if (!striped) return;
    ctx.fillStyle = hex(stripe);
    for (let x = 0; x < w; x += 24) ctx.fillRect(x, 0, 10, h);
  };

  const light = shouldInkBeLight(
    { luma: level, hi: level },
    VIREGLASS_MATERIAL.legibility,
    level < 0.5,
  );
  const optics = resolveOptics({ ...VIREGLASS_MATERIAL, ink: light ? INK_LIGHT : INK_DARK });
  const geometry = roundedRectGeometry(220, 120, 32);
  const piece = { optics, geometry, centerX: canvas.width / 2, centerY: canvas.height / 2 };

  // Зонд отчитывается с отставанием, а оценка досчитывается несколько кадров.
  for (let i = 0; i < 30; i += 1) {
    renderer.render({ density: 1, debug: 'normal', scene, pieces: [piece] });
  }

  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  const row = (cy, halfW) => {
    const n = halfW * 2;
    const buf = new Uint8Array(n * 8 * 4);
    gl.readPixels(canvas.width / 2 - halfW, canvas.height - cy - 4, n, 8, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const v = [];
    for (let i = 0; i < n * 8; i += 1) {
      v.push(0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2]);
    }
    v.sort((a, b) => a - b);
    const at = (q) => v[Math.min(v.length - 1, Math.floor(v.length * q))];
    return [at(0.05), at(0.95), at(0.5)];
  };

  // Внутри — плоская середина, мимо фаски. Снаружи — то же полотно выше детали. Кромка —
  // полоса по верхнему краю: над ровным фоном различимость может жить именно там.
  return {
    inside: row(canvas.height / 2, 60),
    outside: row(canvas.height / 2 - 110, 60),
    rim: row(canvas.height / 2 - 58, 60),
  };
};
`;

async function main() {
  const bundle = await build({
    stdin: { contents: ENTRY, resolveDir: HERE, loader: 'ts' },
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'silent',
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const spread = ([lo, hi]) => hi - lo;
  const failed = [];
  let worstWindow = { value: Infinity, level: 0 };
  let worstPresence = { value: Infinity, level: 0 };

  for (let i = 0; i < STEPS; i += 1) {
    const level = 0.04 + (0.9 * i) / (STEPS - 1);
    const striped = await page.evaluate((a) => globalThis.vgProbe(a), { level, striped: true });
    const flat = await page.evaluate((a) => globalThis.vgProbe(a), { level, striped: false });

    const transmission = spread(striped.inside) / Math.max(spread(striped.outside), 1e-6);
    // Отход считается В ОБЕ СТОРОНЫ: над светлым полотном деталь отходит ВНИЗ, и метрика,
    // смотрящая только на самое яркое, такую кромку не видит вовсе.
    const presence = Math.max(
      Math.abs(flat.inside[2] - flat.outside[2]),
      Math.abs(flat.rim[1] - flat.outside[2]),
      Math.abs(flat.rim[0] - flat.outside[2]),
    );
    if (transmission < worstWindow.value) worstWindow = { value: transmission, level };
    if (presence < worstPresence.value) worstPresence = { value: presence, level };

    const ok = transmission >= MIN_TRANSMISSION && presence >= MIN_PRESENCE;
    console.log(
      `${ok ? ' ' : '!'} полотно ${level.toFixed(2)}: окно ${(transmission * 100).toFixed(0)}%, ` +
        `предмет ${presence.toFixed(1)}`,
    );
    if (!(transmission >= MIN_TRANSMISSION)) {
      failed.push(`на полотне ${level.toFixed(2)} деталь перестала быть окном`);
    }
    if (!(presence >= MIN_PRESENCE)) {
      failed.push(`на полотне ${level.toFixed(2)} деталь пропала над ровным фоном`);
    }
  }
  await browser.close();

  console.log(
    `худшее: окно ${(worstWindow.value * 100).toFixed(0)}% на ${worstWindow.level.toFixed(2)} ` +
      `(нужно ≥ ${MIN_TRANSMISSION * 100}%), предмет ${worstPresence.value.toFixed(1)} ` +
      `на ${worstPresence.level.toFixed(2)} (нужно ≥ ${MIN_PRESENCE})`,
  );

  if (failed.length) {
    console.error(`check-optics: ${failed.join('; ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('check-optics: стекло остаётся и окном, и предметом на всём диапазоне полотна');
}

await main();
