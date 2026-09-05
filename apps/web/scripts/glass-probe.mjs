#!/usr/bin/env node
/**
 * Измеритель кадра для стенда VireGlass (`/rnd`) — веб-аналог `apps/mobile/scripts/glass-probe.mjs`.
 *
 * Кадр берётся ИЗ КАНВАСА (`toDataURL`), а не скриншотом страницы: скриншот в headless не
 * захватывает содержимое WebGL — возвращает чёрное поле там, где канвас на самом деле
 * нарисован. Заодно так меряется ровно то, что нарисовал движок, без композитинга страницы.
 *
 * Вьюпорт — размер телефона (360×800 CSS, dpr 3), поэтому кадр выходит 1080×2400 и
 * сравнивается со снимками Android напрямую. Координаты команд — в пикселях кадра.
 *
 *   node scripts/glass-probe.mjs capture "zone=11&preset=2" [файл.png]
 *   node scripts/glass-probe.mjs stats   "zone=11" 470 460 60 60
 *   node scripts/glass-probe.mjs band    "zone=3"  470 440 120 240
 *
 * Замер идёт ПАРОЙ — внутри стекла и на том же участке рядом: метрика шума не отличает
 * чистый рендер от стекла, которому нечего показать (на Android так пропустили целую серию
 * недействительных замеров).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';

const BASE = process.env.RND_BASE ?? 'http://127.0.0.1:3000/rnd';
const VIEWPORT = { width: 360, height: 800 };
const SCALE = 3;
const SHOTS = 'scripts/.glass-shots';

const url = (query) => (query ? `${BASE}?${query}` : BASE);

async function withStand(query, fn) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url(query), { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="rnd-state"]', { timeout: 15000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (errors.length) {
    await browser.close();
    throw new Error(`стенд упал: ${errors[0]}`);
  }
  const result = await fn(page);
  await browser.close();
  return result;
}

async function frame(page) {
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function capture(query, out) {
  const png = await withStand(query, frame);
  const file = out ?? join(SHOTS, `${(query || 'default').replace(/[^\w=-]+/g, '_')}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
  console.log(file);
}

async function stats(query, x, y, w, h) {
  const png = await withStand(query, frame);
  console.log(JSON.stringify(measure(crop(decodePng(png), x, y, w, h)), null, 1));
}

/** Скачки светлоты по вертикали — так виден бандинг на почти-чёрном градиенте. */
async function band(query, x, y, w, h) {
  const png = await withStand(query, frame);
  const { data, width, height } = crop(decodePng(png), x, y, w, h);
  const rows = [];
  for (let row = 0; row < height; row++) {
    let sum = 0;
    for (let col = 0; col < width; col++) sum += luma(data, (row * width + col) * 4);
    rows.push(sum / width);
  }
  const jumps = [];
  for (let i = 1; i < rows.length; i++) {
    const d = Math.abs(rows[i] - rows[i - 1]) * 255;
    if (d > 0.8) jumps.push({ строка: y + i, скачок: round(d) });
  }
  console.log(JSON.stringify({ строк: rows.length, скачков: jumps.length, где: jumps.slice(0, 8) }, null, 1));
}

const luma = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

function crop({ data, width, height }, x, y, w, h) {
  const x0 = Math.max(0, x | 0);
  const y0 = Math.max(0, y | 0);
  const cw = Math.min(w | 0, width - x0);
  const ch = Math.min(h | 0, height - y0);
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let row = 0; row < ch; row++) {
    const from = ((y0 + row) * width + x0) * 4;
    out.set(data.subarray(from, from + cw * 4), row * cw * 4);
  }
  return { data: out, width: cw, height: ch };
}

function measure({ data, width, height }) {
  const n = width * height;
  const values = new Float64Array(n);
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    values[i] = luma(data, i * 4);
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    if ((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255)) clipped++;
  }
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const noise = values.reduce((s, v) => s + Math.abs(v - mean), 0) / n;
  return { светлота: round(mean), шум: round(noise), упор: `${round((clipped / n) * 100)} %` };
}

/** PNG от canvas.toDataURL — 8 бит RGBA, без интерлейса и палитры. */
function decodePng(buffer) {
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = new Uint8ClampedArray(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? cur[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    out.set(cur, row * stride);
    prev = cur;
  }
  return { data: out, width, height };
}

const round = (v) => Math.round(v * 1000) / 1000;

const [cmd, ...rest] = process.argv.slice(2);
const nums = (n) => rest.slice(1, 1 + n).map(Number);
if (cmd === 'capture') await capture(rest[0], rest[1]);
else if (cmd === 'stats') await stats(rest[0], ...nums(4));
else if (cmd === 'band') await band(rest[0], ...nums(4));
else {
  console.error('команды: capture <query> [файл] · stats <query> x y w h · band <query> x y w h');
  process.exit(1);
}
