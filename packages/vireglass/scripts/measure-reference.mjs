#!/usr/bin/env node
/**
 * ПРОФИЛЬ ДЕТАЛИ НА СВЕРОЧНОМ ПОЛОТНЕ — число вместо впечатления «на Android выглядит иначе».
 *
 * Меряет одно и то же с двух сторон и печатает одну и ту же таблицу:
 *   --web         рендер веб-стендом (headless, тот же рендерер, что и в гейтах);
 *   --shot=<png>  снимок мобильной лаборатории (adb exec-out screencap -p > lab.png).
 *
 * Полотно сверочной сцены — горизонтальные полосы во всю ширину, поэтому фон ПОД телом
 * ИЗВЕСТЕН, а не экстраполирован: это та же строка левее детали. Правило замеров, на котором
 * сгорели три разбора подряд, здесь выполняется по построению.
 *
 * Полотно и деталь на снимке находятся сами: поле вокруг полотна залито REFERENCE_SURROUND,
 * высота полотна известна в dp — отсюда масштаб снимка; центр детали стоит в центре полотна на
 * обоих стендах.
 *
 * Запуск (через tsx — скрипт читает исходники пакета):
 *   pnpm --filter @vire/vireglass measure:reference -- --web [--density=2.75] [--debug=backdrop]
 *   pnpm --filter @vire/vireglass measure:reference -- --shot=lab.png
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { REFERENCE_SCENE_HEIGHT, REFERENCE_SHAPES, REFERENCE_SURROUND } from '../src/reference-scene';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = resolve(HERE, '../src/index.ts').replace(/\\/g, '/');
const WEB = resolve(HERE, '../src/web/index.ts').replace(/\\/g, '/');
const FFMPEG = process.env.VG_FFMPEG
  ?? 'C:/Users/KOTLAEV/vire/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg.exe';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
};

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Общая часть обоих путей: кадр RGBA, известный масштаб, известный центр детали. Строки берутся
 * с отступом от кромки — там работают преломление и кромочный свет, к телу они отношения не
 * имеют, а по ширине берётся только середина хорды по той же причине.
 */
function profile({ px, width, height, pxPerDp, cx, cy, radiusDp }) {
  const at = (x, y) => {
    const o = (y * width + x) * 4;
    return lum(px[o], px[o + 1], px[o + 2]);
  };
  const r = radiusDp * pxPerDp;
  // Столбец фона — левее детали и левее любого её оптического следа.
  const backX = Math.max(2, Math.round(cx - r - 40 * pxPerDp));
  const rows = [];
  for (let dy = -0.72; dy <= 0.721; dy += 0.12) {
    const y = Math.round(cy + dy * r);
    if (y < 0 || y >= height) continue;
    const half = Math.round(Math.sqrt(Math.max(1 - dy * dy, 0)) * r * 0.55);
    let sum = 0;
    let n = 0;
    for (let x = cx - half; x <= cx + half; x += 1) {
      if (x < 0 || x >= width) continue;
      sum += at(x, y);
      n += 1;
    }
    if (!n) continue;
    const back = at(backX, y);
    rows.push({ dp: Math.round(dy * radiusDp), body: sum / n, back, dev: sum / n - back });
  }
  if (!rows.length) throw new Error('деталь не попала в кадр: проверь, что снята сверочная зона');
  return rows;
}

function report(title, rows) {
  console.log('--- ' + title + ' ---');
  console.log('   dp    фон   тело   отход');
  for (const r of rows) {
    const sign = r.dev >= 0 ? '+' : '';
    console.log(
      String(r.dp).padStart(5) + ' ' + r.back.toFixed(0).padStart(6) + ' ' + r.body.toFixed(0).padStart(6)
        + '   ' + sign + r.dev.toFixed(1),
    );
  }
  const worst = rows.reduce((a, b) => (Math.abs(b.dev) > Math.abs(a.dev) ? b : a), rows[0]);
  const mean = rows.reduce((s, r) => s + r.dev, 0) / rows.length;
  console.log(
    'средний отход ' + (mean >= 0 ? '+' : '') + mean.toFixed(1) + ', наибольший '
      + (worst.dev >= 0 ? '+' : '') + worst.dev.toFixed(1) + ' на ' + worst.dp + ' dp (фон '
      + worst.back.toFixed(0) + ')',
  );
}

const ENTRY = [
  "import { createVireGlassRenderer } from '" + WEB + "';",
  "import {",
  "  REFERENCE_BANDS,",
  "  REFERENCE_SCENE_HEIGHT,",
  "  REFERENCE_SHAPES,",
  "  REFERENCE_SURROUND,",
  "  refGray,",
  "  resolveOptics,",
  "  MATERIAL_PRESETS,",
  "  VIREGLASS_MATERIAL,",
  "} from '" + CORE + "';",
  "",
  "globalThis.vgReference = ({ density, debug, shape, preset }) => {",
  "  const canvas = document.createElement('canvas');",
  "  canvas.width = Math.round(360 * density);",
  "  canvas.height = Math.round((REFERENCE_SCENE_HEIGHT + 80) * density);",
  "  document.body.append(canvas);",
  "  const renderer = createVireGlassRenderer(canvas);",
  "  renderer.resize(canvas.width, canvas.height);",
  "",
  "  const scene = (ctx, w, h, ox, oy, d) => {",
  "    ctx.fillStyle = REFERENCE_SURROUND;",
  "    ctx.fillRect(0, 0, w, h);",
  "    let y = Math.round((h - REFERENCE_SCENE_HEIGHT * d) / 2);",
  "    for (const band of REFERENCE_BANDS) {",
  "      const bh = Math.round(band.heightDp * d);",
  "      ctx.fillStyle = refGray(band.level);",
  "      ctx.fillRect(0, y, band.splitLevel === undefined ? w : w / 2, bh);",
  "      if (band.splitLevel !== undefined) {",
  "        ctx.fillStyle = refGray(band.splitLevel);",
  "        ctx.fillRect(w / 2, y, w - w / 2, bh);",
  "      }",
  "      if (band.bar) {",
  "        const t = Math.round(bh * band.bar.thickness);",
  "        ctx.fillStyle = refGray(band.bar.level);",
  "        ctx.fillRect(0, y + Math.round((bh - t) / 2), w, t);",
  "      }",
  "      y += bh;",
  "    }",
  "  };",
  "",
  "  const geometry = REFERENCE_SHAPES[shape];",
  "  const piece = {",
  "    optics: resolveOptics(preset ? MATERIAL_PRESETS[preset] : VIREGLASS_MATERIAL),",
  "    geometry,",
  "    centerX: canvas.width / 2,",
  "    centerY: canvas.height / 2,",
  "  };",
  "  for (let i = 0; i < 30; i += 1) renderer.render({ density, debug, scene, pieces: [piece] });",
  "",
  "  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });",
  "  const buf = new Uint8Array(canvas.width * canvas.height * 4);",
  "  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);",
  "  // GL отсчитывает снизу: переворачиваем, чтобы кадр читался так же, как снимок с устройства.",
  "  const out = new Uint8Array(buf.length);",
  "  const stride = canvas.width * 4;",
  "  for (let y = 0; y < canvas.height; y += 1) {",
  "    out.set(buf.subarray((canvas.height - 1 - y) * stride, (canvas.height - y) * stride), y * stride);",
  "  }",
  "  return {",
  "    width: canvas.width,",
  "    height: canvas.height,",
  "    radiusDp: Math.min(geometry.width, geometry.height) / 2,",
  "    px: Array.from(out),",
  "  };",
  "};",
].join('\n');

/** Полотно на снимке: полоса между двумя полями окружения по левому краю. Отсюда же масштаб. */
function locateStrip(px, width, height, surround) {
  const isSurround = (y) => {
    const o = (y * width + 2) * 4;
    return Math.abs(px[o] - surround[0]) < 10
      && Math.abs(px[o + 1] - surround[1]) < 10
      && Math.abs(px[o + 2] - surround[2]) < 10;
  };
  let best = null;
  let y = 0;
  while (y < height) {
    if (!isSurround(y)) { y += 1; continue; }
    while (y < height && isSurround(y)) y += 1;
    const top = y;
    while (y < height && !isSurround(y)) y += 1;
    if (y >= height) break;
    if (!best || y - top > best.bottom - best.top) best = { top, bottom: y };
  }
  if (!best) throw new Error('полотно не найдено: на снимке нет поля окружения сверочной сцены');
  return best;
}

async function fromWeb() {
  const density = Number(arg('density', '2.75'));
  const debug = arg('debug', 'normal');
  const shape = arg('shape', 'круг');
  const preset = arg('preset', '');
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
  const frame = await page.evaluate((a) => globalThis.vgReference(a), { density, debug, shape, preset });
  await browser.close();

  report(
    'веб · density ' + density + ' · ' + debug + ' · ' + shape + ' · ' + (preset || 'база'),
    profile({
      px: Uint8Array.from(frame.px),
      width: frame.width,
      height: frame.height,
      pxPerDp: density,
      cx: Math.round(frame.width / 2),
      cy: Math.round(frame.height / 2),
      radiusDp: frame.radiusDp,
    }),
  );
}

/** Размер PNG — из IHDR: тащить сюда декодер ради двух чисел не нужно. */
function pngSize(file) {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  if (head.toString('ascii', 1, 4) !== 'PNG') throw new Error('снимок обязан быть PNG');
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

async function fromShot(src) {
  const { width, height } = pngSize(src);
  const tmp = src + '.rgba';
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src, '-pix_fmt', 'rgba', '-f', 'rawvideo', tmp]);
  const px = new Uint8Array(fs.readFileSync(tmp));
  fs.unlinkSync(tmp);

  const hex = REFERENCE_SURROUND.slice(1);
  const surround = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const strip = locateStrip(px, width, height, surround);
  const pxPerDp = (strip.bottom - strip.top) / REFERENCE_SCENE_HEIGHT;
  const geometry = REFERENCE_SHAPES[arg('shape', 'круг')];
  report(
    'снимок ' + src + ' · ' + width + '×' + height + ' · ' + pxPerDp.toFixed(2) + ' px/dp',
    profile({
      px,
      width,
      height,
      pxPerDp,
      cx: Math.round(width / 2),
      cy: Math.round((strip.top + strip.bottom) / 2),
      radiusDp: Math.min(geometry.width, geometry.height) / 2,
    }),
  );
}

const shot = arg('shot');
if (shot) await fromShot(shot);
else if (args.includes('--web')) await fromWeb();
else {
  console.error('нужен --web или --shot=<png>');
  process.exit(2);
}
