#!/usr/bin/env node
/**
 * ПРОФИЛЬ ДЕТАЛИ НА СВЕРОЧНОМ ПОЛОТНЕ — число вместо впечатления «на Android выглядит иначе».
 *
 * Меряет одно и то же с двух сторон и печатает одну и ту же таблицу:
 *   --web         рендер веб-стендом (headless, тот же рендерер, что и в гейтах);
 *   --shot=<png>  снимок мобильной лаборатории (adb exec-out screencap -p > lab.png).
 *
 * Внешних инструментов не требует: PNG снимка разбирается здесь же.
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
 *   pnpm --filter @vire/vireglass measure:reference -- --web [--scene=ступени] [--density=3] [--debug=backdrop]
 *   pnpm --filter @vire/vireglass measure:reference -- --shot=lab.png
 *
 * Снимок с устройства снимается так (полотно выбирается диплинком, панель убрана):
 *   adb shell am start -a android.intent.action.VIEW -d "vire://lab?zone=NN&panel=0&auto=0" PKG
 *   adb exec-out screencap -p > lab.png
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { DEBUG_MODES, PRESET_NAMES } from '../src/material';

import {
  REFERENCE_PIECE_AT,
  REFERENCE_SCENE_HEIGHT,
  REFERENCE_SCENE_WIDTH,
  REFERENCE_SHAPES,
  REFERENCE_SURROUND,
} from '../src/reference-scene';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEBUG_INDEX = Object.fromEntries(DEBUG_MODES.map((m, i) => [m, i]));
const PRESET_INDEX = (name) => PRESET_NAMES.indexOf(name);
const surroundRgb = () => {
  const hex = REFERENCE_SURROUND.slice(1);
  return [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
};
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
};

// Отладочные каналы кладут в r/g/b три РАЗНЫЕ величины, и светлота смешивает их в одно число.
// --channel=r|g|b читает канал как есть; по умолчанию меряется светлота.
const CHANNEL = { luma: -1, r: 0, g: 1, b: 2 }[arg('channel', 'luma')] ?? -1;
const lum = (r, g, b) => (CHANNEL < 0 ? 0.2126 * r + 0.7152 * g + 0.0722 * b : [r, g, b][CHANNEL]);

/**
 * Общая часть обоих путей: кадр RGBA, известный масштаб, известный центр детали. Строки берутся
 * с отступом от кромки — там работают преломление и кромочный свет, к телу они отношения не
 * имеют, а по ширине берётся только середина хорды по той же причине.
 *
 * Фон меряется ТЕМ ЖЕ окном, что и тело, — по столько же пикселей и столько же строк. Иначе
 * на полотнах со структурой сравниваются разные величины: тело усреднено, а фон взят точкой.
 */
function profile({ px, width, height, pxPerDp, cx, cy, radiusDp }) {
  const at = (x, y) => {
    const o = (y * width + x) * 4;
    return lum(px[o], px[o + 1], px[o + 2]);
  };
  const r = radiusDp * pxPerDp;
  // Фон берётся ТЕМ ЖЕ ОКНОМ, что и тело, и левее детали — левее любого её оптического следа.
  // Одним пикселем нельзя: на полотнах с вертикальной структурой (полосы, сетка) он попадает то
  // на линию, то между ними, и отход скачет на десятки единиц от одного положения окна.
  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
  // Окно в НЕСКОЛЬКО строк, а не в одну: на полотнах с горизонтальной структурой (сетка) одна
  // строка то попадает на линию, то проходит мимо, и отход скачет на десятки единиц от сдвига
  // на пиксель. Пять строк — меньше трети шага самого частого узора, полосы оно не смешивает.
  const ROWS = 2;
  const span = (from, to, y) => {
    const xs = [];
    for (let dy = -ROWS; dy <= ROWS; dy += 1) {
      const row = y + dy;
      if (row < 0 || row >= height) continue;
      for (let x = from; x <= to; x += 1) if (x >= 0 && x < width) xs.push(at(x, row));
    }
    return xs;
  };
  const rows = [];
  for (let dy = -0.72; dy <= 0.721; dy += 0.12) {
    const y = Math.round(cy + dy * r);
    if (y < 0 || y >= height) continue;
    const half = Math.round(Math.sqrt(Math.max(1 - dy * dy, 0)) * r * 0.55);
    const chord = span(cx - half, cx + half, y);
    const backFrom = Math.max(2, Math.round(cx - r - 40 * pxPerDp) - half);
    const outside = span(backFrom, backFrom + 2 * half, y);
    if (!chord.length || !outside.length) continue;
    const body = mean(chord);
    const back = mean(outside);
    rows.push({ dp: Math.round(dy * radiusDp), body, back, dev: body - back });
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

/**
 * Полотно на снимке: полоса между двумя полями окружения. Отсюда же масштаб снимка.
 *
 * Смотрим СРЕДНИЙ столбец, а не левый край: полотно у́же площадки, и по краю поле окружения
 * идёт сверху донизу. В середине столбца выше и ниже полотна — окружение, а само полотно —
 * что угодно, кроме него (в том числе деталь, если она видима).
 */
function locateStrip(px, width, height, surround) {
  const col = width >> 1;
  const isSurround = (y) => {
    const o = (y * width + col) * 4;
    return Math.abs(px[o] - surround[0]) < 10
      && Math.abs(px[o + 1] - surround[1]) < 10
      && Math.abs(px[o + 2] - surround[2]) < 10;
  };
  const runs = [];
  let y = 0;
  while (y < height) {
    if (!isSurround(y)) { y += 1; continue; }
    while (y < height && isSurround(y)) y += 1;
    const top = y;
    while (y < height && !isSurround(y)) y += 1;
    if (y >= height) break;
    runs.push({ top, bottom: y });
  }
  if (!runs.length) throw new Error('полотно не найдено: на снимке нет поля окружения сверочной сцены');
  // Полотен на экране видно несколько (сцена — столбик зон), и нужно ПЕРВОЕ ПОЛНОЕ: именно его
  // лаборатория паркует под деталь. Сравнение «строго длиннее» тут не годится — округление
  // высоты полосы даёт разницу в пиксель, и замер перепрыгивал на соседнее полотно, где детали
  // нет вовсе: отход выходил ровно нулевым и выглядел как исправный байпас.
  const longest = Math.max(...runs.map((r) => r.bottom - r.top));
  return runs.find((r) => r.bottom - r.top >= longest - 2);
}

/**
 * Веб-половина замера — СНИМОК НАСТОЯЩЕГО СТЕНДА, а не своя отрисовка сцены. Своя отрисовка
 * уже разошлась со стендом вчетверо: стенд ведёт полярность надписи автоматикой, а замер брал
 * материал как есть, и на «ступенях» выходило +11 против −70. Сравнивать надо то, на что
 * смотрит глаз, поэтому обе платформы идут через ОДИН путь — снимок и разбор снимка.
 */
async function fromWeb() {
  const density = Number(arg('density', '2.75'));
  const debug = arg('debug', 'normal');
  const shape = arg('shape', 'круг');
  const preset = arg('preset', '');
  const name = arg('scene', 'ступени');
  // --stage=411x914 ставит площадку размером с экран устройства: сетка зонда постоянная на всю
  // площадку, и на тесной она накрывает деталь гуще, чем там.
  const stage = arg('stage', '411x914').split('x').map(Number);
  const stageW = Number.isFinite(stage[0]) && stage[0] > 0 ? stage[0] : 411;
  const stageH = Number.isFinite(stage[1]) && stage[1] > 0 ? stage[1] : 914;
  const base = arg('stand', '');
  const url = new URL(base || 'http://127.0.0.1:0/rnd/');

  const server = base ? null : await listen(serveStand());
  if (server) url.port = String(server.port);
  url.searchParams.set('zone', name);
  url.searchParams.set('shape', shape);
  url.searchParams.set('ui', '0');
  if (debug !== 'normal') url.searchParams.set('debug', String(DEBUG_INDEX[debug] ?? 0));
  if (preset) url.searchParams.set('preset', String(PRESET_INDEX(preset)));

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: stageW, height: stageH },
    deviceScaleFactor: density,
  });
  await page.goto(url.toString());
  // Зонд отчитывается с отставанием, а оценка среды и полярность досчитываются несколько кадров.
  await page.waitForTimeout(3500);
  const shot = await page.screenshot();
  await browser.close();
  server?.close();

  const frame = decodePng(shot);
  const strip = locateStrip(frame.px, frame.width, frame.height, surroundRgb());
  const pxPerDp = (strip.bottom - strip.top) / REFERENCE_SCENE_HEIGHT;
  report(
    'стенд · ' + name + ' · ' + stageW + 'x' + stageH + ' · density ' + density + ' · ' + debug
      + ' · ' + shape + ' · ' + (preset || 'база'),
    profile({
      px: frame.px,
      width: frame.width,
      height: frame.height,
      pxPerDp,
      cx: Math.round(frame.width / 2 + (REFERENCE_PIECE_AT.xDp - REFERENCE_SCENE_WIDTH / 2) * pxPerDp),
      cy: Math.round(strip.top + REFERENCE_PIECE_AT.yDp * pxPerDp),
      radiusDp: Math.min(REFERENCE_SHAPES[shape].width, REFERENCE_SHAPES[shape].height) / 2,
    }),
  );
}

/** Стенд — статические файлы. Поднимаем их сами, чтобы замер не зависел от чужого сервера. */
function serveStand() {
  const root = resolve(HERE, '../../../apps/web/public');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.map': 'application/json' };
  const srv = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(normalize(root))) { res.writeHead(403).end(); return; }
    try {
      const body = fs.readFileSync(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return srv;
}

/** Слушать порт — операция асинхронная: адрес появляется только после события. */
function listen(srv) {
  return new Promise((done) => {
    srv.listen(0, '127.0.0.1', () => done({ port: srv.address().port, close: () => srv.close() }));
  });
}

/**
 * Снимок → RGBA. Декодер здесь свой: `adb exec-out screencap -p` отдаёт ровно один вид PNG
 * (8 бит на канал, без чересстрочности), и ради него тянуть в пакет ffmpeg или библиотеку не
 * стоит — тем более что путь к внешнему ffmpeg у каждого свой и скрипт перестаёт запускаться.
 */
function readPng(file) {
  return decodePng(fs.readFileSync(file));
}

function decodePng(buf) {
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('снимок обязан быть PNG');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const depth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
    throw new Error('поддерживается только PNG 8 бит RGB/RGBA без чересстрочности');
  }
  const channels = colorType === 6 ? 4 : 3;

  const parts = [];
  for (let at = 8; at + 8 <= buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    if (type === 'IDAT') parts.push(buf.subarray(at + 8, at + 8 + length));
    at += length + 12;
    if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(parts));

  // Развёртка фильтров PNG: каждая строка начинается байтом своего фильтра и ссылается на
  // левый пиксель и строку выше — распаковывать приходится подряд, строка за строкой.
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + add) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      out[o] = line[x * channels];
      out[o + 1] = line[x * channels + 1];
      out[o + 2] = line[x * channels + 2];
      out[o + 3] = channels === 4 ? line[x * channels + 3] : 255;
    }
    line.copy(prev);
  }
  return { width, height, px: out };
}

async function fromShot(src) {
  const { width, height, px } = readPng(src);

  const hex = REFERENCE_SURROUND.slice(1);
  const surround = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const strip = locateStrip(px, width, height, surround);
  const pxPerDp = (strip.bottom - strip.top) / REFERENCE_SCENE_HEIGHT;
  const geometry = REFERENCE_SHAPES[arg('shape', 'круг')];
  // Деталь ищется не «где-то посередине», а в точке, заданной полотном: полотно по центру
  // площадки, отсчёт от его левого верхнего угла.
  report(
    'снимок ' + src + ' · ' + width + '×' + height + ' · ' + pxPerDp.toFixed(2) + ' px/dp',
    profile({
      px,
      width,
      height,
      pxPerDp,
      cx: Math.round(width / 2 + (REFERENCE_PIECE_AT.xDp - REFERENCE_SCENE_WIDTH / 2) * pxPerDp),
      cy: Math.round(strip.top + REFERENCE_PIECE_AT.yDp * pxPerDp),
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
