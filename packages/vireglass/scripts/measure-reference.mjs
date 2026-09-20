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
 *   pnpm --filter @vire/vireglass measure:reference -- --web --scene=ровное --shadow
 *
 * --shadow (только с --web) меряет не тело, а ТЕНЬ ПОД ДЕТАЛЬЮ: глубину провала светлоты ниже
 * нижней кромки относительно фона той же строки слева и справа от детали. Кромка берётся из
 * геометрии фигуры (центр детали и её высота известны скрипту), не поиском провала — иначе
 * кромка гуляет вместе с порогом.
 *
 * Снимок с устройства снимается так (полотно выбирается диплинком, панель убрана):
 *   adb shell am start -a android.intent.action.VIEW -d "vire://lab?zone=NN&panel=0&auto=0" PKG
 *   adb exec-out screencap -p > lab.png
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { deflateSync, inflateSync } from 'node:zlib';
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
  /** Размах по краям распределения, а не min/max: одна точка не должна решать за всё окно. */
  const spread = (xs) => {
    const v = [...xs].sort((a, b) => a - b);
    const at = (q) => v[Math.min(v.length - 1, Math.floor(v.length * q))];
    return at(0.95) - at(0.05);
  };
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
    rows.push({
      dp: Math.round(dy * radiusDp),
      body,
      back,
      dev: body - back,
      // РАЗМАХ, а не только уровень. Средняя светлота одинакова и когда под стеклом видна
      // фактура, и когда она стёрта в ровное молоко: на полотне «сетка» два стенда дали −4.8 и
      // −4.9, при том что в одном линии проходят насквозь, а в другом их нет вовсе.
      spread: spread(chord),
      backSpread: spread(outside),
    });
  }
  if (!rows.length) throw new Error('деталь не попала в кадр: проверь, что снята сверочная зона');
  return rows;
}

function report(title, rows) {
  console.log('--- ' + title + ' ---');
  console.log('   dp    фон   тело   отход   размах сн./вн.');
  for (const r of rows) {
    const sign = r.dev >= 0 ? '+' : '';
    console.log(
      String(r.dp).padStart(5) + ' ' + r.back.toFixed(0).padStart(6) + ' ' + r.body.toFixed(0).padStart(6)
        + '   ' + (sign + r.dev.toFixed(1)).padStart(7)
        + '   ' + r.backSpread.toFixed(0).padStart(5) + ' ' + r.spread.toFixed(0).padStart(5),
    );
  }
  const worst = rows.reduce((a, b) => (Math.abs(b.dev) > Math.abs(a.dev) ? b : a), rows[0]);
  const mean = rows.reduce((s, r) => s + r.dev, 0) / rows.length;
  const outer = rows.reduce((s, r) => s + r.backSpread, 0);
  const inner = rows.reduce((s, r) => s + r.spread, 0);
  console.log(
    'средний отход ' + (mean >= 0 ? '+' : '') + mean.toFixed(1) + ', наибольший '
      + (worst.dev >= 0 ? '+' : '') + worst.dev.toFixed(1) + ' на ' + worst.dp + ' dp (фон '
      + worst.back.toFixed(0) + ')',
  );
  // Доля фактуры, дожившей под стекло. Ноль — деталь стала молочной плашкой, и никакой отход
  // об этом не скажет: он про уровень, а не про то, видно ли сквозь.
  console.log(
    'пропускание фактуры ' + (outer > 1 ? Math.round((inner / outer) * 100) : 0) + '%'
      + ' (размах снаружи ' + (outer / rows.length).toFixed(0) + ', внутри ' + (inner / rows.length).toFixed(0) + ')',
  );
}

/**
 * Профиль ТЕНИ под деталью. Нижняя кромка приходит СНАРУЖИ (из геометрии), а не ищется по
 * провалу светлоты — порог для поиска кромки на этом материале уже пять раз сжигал разбор.
 * Фон строки — то же окно, что и центр, отставленное от кромки детали за пределы её разлёта
 * (реальный максимум — shadowReachDp, ≤36dp; запас 40dp взят с той же меркой, что и в profile()
 * выше). Окно ставится СРАЗУ по обе стороны — это два независимых замера фона, не один
 * усреднённый, и таблица показывает оба.
 */
function shadowProfile({ px, width, height, pxPerDp, cx, edgeY, halfWidthDp, maxDp, stepDp }) {
  const at = (x, y) => {
    const o = (y * width + x) * 4;
    return lum(px[o], px[o + 1], px[o + 2]);
  };
  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
  // Окно под центром — доля полуширины детали: остаётся в самом тёмном месте тени, не наползая
  // на кромку, где ещё работает кромочный свет линзы.
  const halfWinDp = Math.min(halfWidthDp * 0.4, 30);
  const winPx = Math.max(1, Math.round(halfWinDp * pxPerDp));
  const marginDp = 40;
  const sideOffsetPx = Math.round((halfWidthDp + marginDp + halfWinDp) * pxPerDp);
  if (cx - sideOffsetPx - winPx < 0 || cx + sideOffsetPx + winPx >= width) {
    throw new Error('боковое опорное окно тени вышло за кадр: деталь или полотно слишком узкие для этого замера');
  }
  // Окно возвращает СПИСОК пикселей, а не сразу среднее: у фона его нужно и целиком (общий
  // знаменатель формулы — «строка по бокам», оба борта вместе), и порознь (проверка §4).
  const window = (x0, y) => {
    const xs = [];
    for (let x = x0 - winPx; x <= x0 + winPx; x += 1) if (x >= 0 && x < width) xs.push(at(x, y));
    return xs;
  };
  const rows = [];
  for (let dp = 0; dp <= maxDp; dp += stepDp) {
    const y = Math.round(edgeY + dp * pxPerDp);
    if (y < 0 || y >= height) break;
    const leftXs = window(cx - sideOffsetPx, y);
    const rightXs = window(cx + sideOffsetPx, y);
    const center = mean(window(cx, y));
    const left = mean(leftXs);
    const right = mean(rightXs);
    const back = mean([...leftXs, ...rightXs]);
    rows.push({
      dp, center, left, right, back,
      depth: (1 - center / back) * 100,
      depthLeft: (1 - center / left) * 100,
      depthRight: (1 - center / right) * 100,
    });
  }
  if (!rows.length) throw new Error('тень не попала в кадр: увеличь --stage или уменьши --reach');
  return rows;
}

function reportShadow(title, rows, pieceHeightDp) {
  console.log('--- ' + title + ' ---');
  console.log('  dp   центр   слева  справа    фон  глубина  глубина(л)  глубина(п)');
  for (const r of rows) {
    console.log(
      String(r.dp).padStart(4) + ' ' + r.center.toFixed(1).padStart(7) + ' '
        + r.left.toFixed(1).padStart(7) + ' ' + r.right.toFixed(1).padStart(7) + ' '
        + r.back.toFixed(1).padStart(6) + '  '
        + (r.depth >= 0 ? '+' : '') + r.depth.toFixed(1).padStart(6) + '%   '
        + (r.depthLeft >= 0 ? '+' : '') + r.depthLeft.toFixed(1).padStart(6) + '%   '
        + (r.depthRight >= 0 ? '+' : '') + r.depthRight.toFixed(1).padStart(6) + '%',
    );
  }
  let maxRow = rows[0];
  for (const r of rows) if (r.depth > maxRow.depth) maxRow = r;
  // Длина тени — dp до первого возврата к фону (глубина ⩽ 0), не порог: ноль здесь и есть сама
  // метрика («тело уже не темнее фона»), а не подгонка под материал.
  let lengthDp = rows[rows.length - 1].dp;
  for (const r of rows) {
    if (r.depth <= 0) { lengthDp = r.dp; break; }
  }
  console.log(
    'максимум глубины ' + maxRow.depth.toFixed(1) + '% на ' + maxRow.dp + ' dp, длина тени '
      + lengthDp + ' dp = ' + (lengthDp / pieceHeightDp).toFixed(2) + ' высоты детали',
  );
  const maxL = rows.reduce((a, b) => (b.depthLeft > a.depthLeft ? b : a), rows[0]);
  const maxR = rows.reduce((a, b) => (b.depthRight > a.depthRight ? b : a), rows[0]);
  const gap = Math.abs(maxL.depthLeft - maxR.depthRight);
  // Два НЕЗАВИСИМЫХ набора столбцов — левый и правый опорный фон замерены порознь, не усреднены
  // заранее (объединённый «фон» в таблице выше — уже производная от обоих). Симметрия материала
  // явно не обещана — если разошлись, сказать прямо, а не спрятать за общим средним.
  console.log(
    (gap > 1
      ? 'левый и правый замер РАСХОДЯТСЯ: максимум слева ' + maxL.depthLeft.toFixed(1) + '% на '
        + maxL.dp + ' dp, максимум справа ' + maxR.depthRight.toFixed(1) + '% на ' + maxR.dp + ' dp'
      : 'левый и правый замер сходятся (расхождение максимумов ' + gap.toFixed(1) + ' п.п.)'),
  );
  return { maxDepth: maxRow.depth, maxDp: maxRow.dp, lengthDp };
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
async function shootStand({ density, debug, shape, preset, name, stageW, stageH, base, ink }) {
  const url = new URL(base || 'http://127.0.0.1:0/rnd/');
  const server = base ? null : await listen(serveStand());
  if (server) url.port = String(server.port);
  url.searchParams.set('zone', name);
  url.searchParams.set('shape', shape);
  url.searchParams.set('ui', '0');
  if (debug !== 'normal') url.searchParams.set('debug', String(DEBUG_INDEX[debug] ?? 0));
  if (preset) url.searchParams.set('preset', String(PRESET_INDEX(preset)));
  // Полярность надписи закрепляется ЯВНО. У решения гистерезис (переворот 0.62, возврат 0.5),
  // и полотно «градиент» ложится ровно в этот зазор: исход тогда зависит от того, из какого
  // состояния стенд вошёл в зону, а не от материала. Автоматику проверяет не эта таблица.
  if (ink !== '') url.searchParams.set('ink', ink);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: stageW, height: stageH },
    deviceScaleFactor: density,
  });
  await page.goto(url.toString());
  // Зонд отчитывается с отставанием, а оценка среды и полярность досчитываются несколько кадров.
  await page.waitForTimeout(3500);
  const png = await page.screenshot();
  await browser.close();
  server?.close();
  return decodePng(png);
}

/** Где на кадре стоит деталь: полотно ищется по полю окружения, отсчёт — от его угла. */
function locatePiece(frame, shape) {
  const strip = locateStrip(frame.px, frame.width, frame.height, surroundRgb());
  const pxPerDp = (strip.bottom - strip.top) / REFERENCE_SCENE_HEIGHT;
  return {
    pxPerDp,
    cx: Math.round(frame.width / 2 + (REFERENCE_PIECE_AT.xDp - REFERENCE_SCENE_WIDTH / 2) * pxPerDp),
    cy: Math.round(strip.top + REFERENCE_PIECE_AT.yDp * pxPerDp),
    radiusDp: Math.min(REFERENCE_SHAPES[shape].width, REFERENCE_SHAPES[shape].height) / 2,
  };
}

/**
 * СЛИЧЕНИЕ КАДРОВ. Два стенда живут в окнах разного размера, и глаз сравнивает не материал, а
 * масштаб показа: на уменьшенном окне тонкая линия под стеклом пропадает вовсе, хотя в пикселях
 * она на месте. Команда вырезает деталь с обоих кадров ОДНИМ окном в dp и кладёт рядом в одном
 * размере — только по такому кадру спор «вижу разницу» имеет смысл.
 */
async function compareFrames(shotFile) {
  const shape = arg('shape', 'круг');
  const name = arg('scene', 'сетка');
  const boxDp = Number(arg('box', '170'));
  const out = arg('out', shotFile.replace(/[.]png$/i, '') + '-сличение.png');

  const phone = readPng(shotFile);
  const phoneAt = locatePiece(phone, shape);
  const density = Number(arg('density', String(Math.round(phoneAt.pxPerDp * 1000) / 1000)));
  const stage = arg('stage', '411x914').split('x').map(Number);
  const web = await shootStand({
    density,
    debug: arg('debug', 'normal'),
    shape,
    preset: arg('preset', ''),
    name,
    stageW: stage[0] || 411,
    stageH: stage[1] || 914,
    base: arg('stand', ''),
    ink: arg('ink', ''),
  });
  const webAt = locatePiece(web, shape);

  const size = Math.round(boxDp * phoneAt.pxPerDp);
  const left = crop(phone, phoneAt.cx, phoneAt.cy, size);
  const right = scaleTo(crop(web, webAt.cx, webAt.cy, Math.round(boxDp * webAt.pxPerDp)), size);
  fs.writeFileSync(out, encodePng(sideBySide(left, right)));
  console.log('сличение: ' + out);
  console.log('слева устройство (' + phoneAt.pxPerDp.toFixed(2) + ' px/dp), справа стенд ('
    + webAt.pxPerDp.toFixed(2) + ' px/dp), окно ' + boxDp + ' dp, оба приведены к ' + size + ' px');
}

function crop(frame, cx, cy, size) {
  const half = size >> 1;
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(Math.max(cx - half + x, 0), frame.width - 1);
      const sy = Math.min(Math.max(cy - half + y, 0), frame.height - 1);
      const s = (sy * frame.width + sx) * 4;
      const d = (y * size + x) * 4;
      px[d] = frame.px[s];
      px[d + 1] = frame.px[s + 1];
      px[d + 2] = frame.px[s + 2];
      px[d + 3] = 255;
    }
  }
  return { width: size, height: size, px };
}

/** Приведение к другому масштабу — УСРЕДНЕНИЕМ, а не выбором точки: точка теряет тонкую линию
 *  ровно так же, как теряет её уменьшенное окно, и сравнение снова врёт. */
function scaleTo(frame, size) {
  const px = new Uint8Array(size * size * 4);
  const k = frame.width / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const x0 = Math.floor(x * k);
      const y0 = Math.floor(y * k);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * k));
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * k));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = y0; sy < Math.min(y1, frame.height); sy += 1) {
        for (let sx = x0; sx < Math.min(x1, frame.width); sx += 1) {
          const s = (sy * frame.width + sx) * 4;
          r += frame.px[s];
          g += frame.px[s + 1];
          b += frame.px[s + 2];
          n += 1;
        }
      }
      const d = (y * size + x) * 4;
      px[d] = Math.round(r / n);
      px[d + 1] = Math.round(g / n);
      px[d + 2] = Math.round(b / n);
      px[d + 3] = 255;
    }
  }
  return { width: size, height: size, px };
}

function sideBySide(a, b) {
  const gap = 8;
  const width = a.width + gap + b.width;
  const height = Math.max(a.height, b.height);
  const px = new Uint8Array(width * height * 4).fill(0);
  const put = (src, ox) => {
    for (let y = 0; y < src.height; y += 1) {
      for (let x = 0; x < src.width; x += 1) {
        const s = (y * src.width + x) * 4;
        const d = (y * width + ox + x) * 4;
        px[d] = src.px[s];
        px[d + 1] = src.px[s + 1];
        px[d + 2] = src.px[s + 2];
        px[d + 3] = 255;
      }
    }
  };
  put(a, 0);
  put(b, a.width + gap);
  return { width, height, px };
}

/** PNG из RGBA. Кодировщик свой по той же причине, что и декодер: одна зависимость ради
 *  тридцати строк не окупается, а вид PNG здесь ровно один. */
function encodePng(frame) {
  const raw = Buffer.alloc(frame.height * (frame.width * 4 + 1));
  for (let y = 0; y < frame.height; y += 1) {
    raw[y * (frame.width * 4 + 1)] = 0;
    Buffer.from(frame.px.buffer, y * frame.width * 4, frame.width * 4)
      .copy(raw, y * (frame.width * 4 + 1) + 1);
  }
  const chunk = (type, body) => {
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 4, "ascii");
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)) >>> 0, 8 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(frame.width, 0);
  ihdr.writeUInt32BE(frame.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

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
  const ink = arg('ink', '');
  const frame = await shootStand({ density, debug, shape, preset, name, stageW, stageH, base, ink });
  const strip = locateStrip(frame.px, frame.width, frame.height, surroundRgb());
  const pxPerDp = (strip.bottom - strip.top) / REFERENCE_SCENE_HEIGHT;
  report(
    'стенд · ' + name + ' · ' + stageW + 'x' + stageH + ' · density ' + density + ' · ' + debug
      + ' · ' + shape + ' · ' + (preset || 'база') + (ink === '' ? ' · полярность авто' : ' · ink=' + ink),
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

/** Тот же снимок стенда, что и fromWeb(), но профиль — под деталью, а не по её силуэту. */
async function fromWebShadow() {
  const density = Number(arg('density', '2.75'));
  const shape = arg('shape', 'круг');
  const preset = arg('preset', '');
  const name = arg('scene', 'ступени');
  const stage = arg('stage', '411x914').split('x').map(Number);
  const stageW = Number.isFinite(stage[0]) && stage[0] > 0 ? stage[0] : 411;
  const stageH = Number.isFinite(stage[1]) && stage[1] > 0 ? stage[1] : 914;
  const base = arg('stand', '');
  const ink = arg('ink', '');
  const frame = await shootStand({ density, debug: 'normal', shape, preset, name, stageW, stageH, base, ink });
  const strip = locateStrip(frame.px, frame.width, frame.height, surroundRgb());
  const pxPerDp = (strip.bottom - strip.top) / REFERENCE_SCENE_HEIGHT;
  const geometry = REFERENCE_SHAPES[shape];
  const cx = Math.round(frame.width / 2 + (REFERENCE_PIECE_AT.xDp - REFERENCE_SCENE_WIDTH / 2) * pxPerDp);
  const cy = Math.round(strip.top + REFERENCE_PIECE_AT.yDp * pxPerDp);
  const edgeY = cy + (geometry.height / 2) * pxPerDp;
  const maxDp = Number(arg('reach', String(Math.round(geometry.height / 2))));
  const rows = shadowProfile({
    px: frame.px,
    width: frame.width,
    height: frame.height,
    pxPerDp,
    cx,
    edgeY,
    halfWidthDp: geometry.width / 2,
    maxDp,
    stepDp: Number(arg('step', '2')),
  });
  reportShadow(
    'тень · ' + name + ' · ' + stageW + 'x' + stageH + ' · density ' + density + ' · ' + shape
      + ' · ' + (preset || 'база'),
    rows,
    geometry.height,
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
const compare = arg('compare');
if (compare) await compareFrames(compare);
else if (shot) await fromShot(shot);
else if (args.includes('--web') && args.includes('--shadow')) await fromWebShadow();
else if (args.includes('--web')) await fromWeb();
else {
  console.error('нужен --web, --shot=<png> или --compare=<png>');
  process.exit(2);
}
