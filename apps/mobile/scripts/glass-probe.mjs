#!/usr/bin/env node
/**
 * Измеритель кадра стекла. Существует потому, что «шум на тёмном фоне» глазами по
 * скриншоту не судится: на глаз одинаково выглядят и чистое стекло, и стекло, которому
 * вообще нечего показать (docs/vireglass/material-lab.md E-27).
 *
 *   node scripts/glass-probe.mjs shot <имя>
 *   node scripts/glass-probe.mjs crop <имя> <x> <y> <w> <h> [zoom]
 *   node scripts/glass-probe.mjs stats <имя> <x> <y> <w> <h>
 *   node scripts/glass-probe.mjs band  <имя> <x> <y> <w> <h>
 *   node scripts/glass-probe.mjs tap   <zone|preset|debug|stage> <prev|next> [раз]
 *   node scripts/glass-probe.mjs fps   [секунд]
 *   node scripts/glass-probe.mjs bench [секунд]   (прогон по сценам, только на устройстве)
 *   node scripts/glass-probe.mjs set   zone=11 preset=2 ior=1.7   (диплинк в стенд)
 *   node scripts/glass-probe.mjs settle [секунд]
 *   node scripts/glass-probe.mjs capture <имя> zone=11 preset=2   (выставить, дождаться, снять)
 *   node scripts/glass-probe.mjs sweep [зоны через запятую] [доп. параметры]
 *
 * Метрики:
 *   noise  — МЕДИАНА локального отклонения от четырёх соседей. Медиана, а не среднее:
 *            границы формы и линии сетки дают выбросы, среднее они утаскивают.
 *   band   — число различимых ступенек светлоты на вертикальном профиле. Полосы на
 *            градиенте это ловит, а noise — нет: внутри полосы отклонение как раз ноль.
 *   clip   — доля пикселей, упёршихся в 0 или 255 хотя бы одним каналом.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.GLASS_SHOTS ?? join(root, '.glass-shots');

function pngjs() {
  // Пакет транзитивный и в node_modules приложения не поднят — ищем в сторе pnpm.
  for (const p of ['pngjs', join(root, '../../node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs')]) {
    try {
      return require(p).PNG;
    } catch {}
  }
  throw new Error('pngjs не найден');
}

const PNG = pngjs();

const PKG = 'com.virespace.viremusic';

function adb(args) {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? '';
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const bin = home && existsSync(join(home, 'platform-tools', exe)) ? join(home, 'platform-tools', exe) : exe;
  return execFileSync(bin, args, { maxBuffer: 64 * 1024 * 1024 });
}

function shot(name) {
  mkdirSync(SHOTS, { recursive: true });
  adb(['shell', 'screencap', '-p', '/sdcard/vgshot.png']);
  const out = join(SHOTS, `${name}.png`);
  adb(['pull', '/sdcard/vgshot.png', out]);
  const png = load(name);
  console.log(`${out} ${png.width}x${png.height}`);
}

function load(name) {
  const file = name.endsWith('.png') ? name : join(SHOTS, `${name}.png`);
  return PNG.sync.read(readFileSync(file));
}

const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

function region(png, x, y, w, h) {
  const out = new Float64Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = Math.min(png.width - 1, x + i);
      const py = Math.min(png.height - 1, y + j);
      out[j * w + i] = luma(png.data, (py * png.width + px) * 4);
    }
  }
  return out;
}

const median = (arr) => {
  const s = Float64Array.from(arr).sort();
  return s.length ? s[s.length >> 1] : 0;
};

function minOf(a) {
  let v = Infinity;
  for (const x of a) if (x < v) v = x;
  return v;
}

function maxOf(a) {
  let v = -Infinity;
  for (const x of a) if (x > v) v = x;
  return v;
}

function stats(name, x, y, w, h) {
  const png = load(name);
  const L = region(png, x, y, w, h);
  const dev = [];
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const c = L[j * w + i];
      const around = (L[(j - 1) * w + i] + L[(j + 1) * w + i] + L[j * w + i - 1] + L[j * w + i + 1]) / 4;
      dev.push(Math.abs(c - around));
    }
  }
  let clipped = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const o = ((y + j) * png.width + (x + i)) * 4;
      const d = png.data;
      if (d[o] >= 255 || d[o + 1] >= 255 || d[o + 2] >= 255) clipped++;
      else if (d[o] <= 0 && d[o + 1] <= 0 && d[o + 2] <= 0) clipped++;
    }
  }
  const mean = L.reduce((a, b) => a + b, 0) / L.length;
  console.log(
    [
      `область   ${x},${y} ${w}x${h}`,
      // Разворачивать массив в аргументы нельзя: на рамке в сотни тысяч пикселей
      // Math.min(...L) кладёт стек. Цикл работает при любом размере.
      `светлота  ${mean.toFixed(1)} (мин ${minOf(L).toFixed(0)} макс ${maxOf(L).toFixed(0)})`,
      `noise     ${median(dev).toFixed(3)} (p90 ${Float64Array.from(dev).sort()[Math.floor(dev.length * 0.9)].toFixed(3)})`,
      `clip      ${((clipped / (w * h)) * 100).toFixed(1)}%`,
    ].join('\n'),
  );
}

/** Ступеньки на вертикальном профиле: сколько раз подряд светлота стоит на месте, а потом
 *  прыгает. На честном градиенте прыжков нет, на полосах их столько же, сколько полос. */
function band(name, x, y, w, h) {
  const png = load(name);
  const L = region(png, x, y, w, h);
  const col = [];
  for (let j = 0; j < h; j++) {
    let s = 0;
    for (let i = 0; i < w; i++) s += L[j * w + i];
    col.push(s / w);
  }
  let steps = 0;
  let runs = 0;
  let run = 0;
  for (let j = 1; j < col.length; j++) {
    const d = col[j] - col[j - 1];
    if (Math.abs(d) < 0.12) {
      run++;
    } else {
      if (run >= 3) {
        runs++;
        steps += Math.abs(d) > 0.8 ? 1 : 0;
      }
      run = 0;
    }
  }
  console.log(`полки ≥3px: ${runs}, из них со скачком >0.8: ${steps}, размах ${(col[col.length - 1] - col[0]).toFixed(1)}`);
}

function crop(name, x, y, w, h, zoom = 1) {
  const png = load(name);
  const z = Math.max(1, Math.round(zoom));
  const out = new PNG({ width: w * z, height: h * z });
  for (let j = 0; j < h * z; j++) {
    for (let i = 0; i < w * z; i++) {
      const sx = Math.min(png.width - 1, x + Math.floor(i / z));
      const sy = Math.min(png.height - 1, y + Math.floor(j / z));
      const s = (sy * png.width + sx) * 4;
      const d = (j * out.width + i) * 4;
      out.data[d] = png.data[s];
      out.data[d + 1] = png.data[s + 1];
      out.data[d + 2] = png.data[s + 2];
      out.data[d + 3] = 255;
    }
  }
  const file = join(SHOTS, `${name}-crop-${x}x${y}.png`);
  writeFileSync(file, PNG.sync.write(out));
  console.log(file);
}

/** Координаты степперов стенда (screens/material-lab.tsx) в пикселях экрана 1080x2400.
 *  Степперы стоят неподвижно и вне прокрутки ровно ради этого. */
const STEPPERS = { zone: 0, preset: 1, debug: 2, stage: 3 };
const STEP_Y = 188;
const STEP_X = (slot, dir) => Math.round(8 + slot * (1080 - 16 + 6) / 4 + (dir === 'next' ? 232 : 52));

function tap(which, dir, times = 1) {
  const slot = STEPPERS[which];
  if (slot === undefined) throw new Error('zone|preset|debug|stage');
  for (let i = 0; i < times; i++) {
    adb(['shell', 'input', 'tap', String(STEP_X(slot, dir)), String(STEP_Y)]);
    // Тапы подряд без паузы теряются: RN успевает обработать не каждый.
    if (times > 1) adb(['shell', 'sleep', '0.35']);
  }
}

/**
 * Состояние стенда, прочитанное ПРЯМО ИЗ КАДРА. В левом верхнем углу стенд рисует метку из
 * двух квадратов: маркер фиксированного цвета (по нему метка находится, не зная ни плотности
 * экрана, ни вырезов) и данные — индексы зоны, пресета и debug-режима, а также полярность
 * надписи и замер фона. Без этого «что было на экране в момент замера» читается только
 * глазами, а это главный источник ложных выводов (material-lab.md E-27).
 */
function readState() {
  // Снимок идёт СРАЗУ в память: круг через /sdcard и pull стоит примерно секунду, а метку
  // приходится перечитывать после каждого шага.
  const png = PNG.sync.read(adb(['exec-out', 'screencap', '-p']));
  const d = png.data;
  const at = (x, y) => (y * png.width + x) * 4;
  // Маркер ищется с ДОПУСКОМ: экран телефона гонит скриншот через цветовой профиль, и чистая
  // маджента приезжает как 234,51,247. Данные поэтому кодируются серым — он проходит точно.
  const isMark = (o) => d[o] > 190 && d[o + 2] > 190 && d[o + 1] < 130;
  for (let y = 40; y < png.height * 0.6; y++) {
    if (!isMark(at(4, y))) continue;
    let w = 4;
    while (w < png.width - 2 && isMark(at(w, y))) w++;
    // Маркер начинается от нуля, значит его ширина И ЕСТЬ w — а не w−4, откуда начат поиск.
    // На ошибке в четыре пикселя последняя клетка читалась из предыдущей.
    const cell = w;
    if (cell < 6) continue;
    // Тот же делитель, что кладёт стенд (STATE_SCALE в material-lab.tsx): индексы приезжают
    // серым, и делитель обязан покрывать самый длинный из списков — зон уже двадцать одна.
    const STATE_SCALE = 32;
    const val = (k) => {
      const o = at(Math.round(w + cell * (k + 0.5)), y + Math.round(cell * 0.5));
      return (d[o] - 16) / 220;
    };
    return {
      zone: Math.round(val(0) * STATE_SCALE),
      preset: Math.round(val(1) * STATE_SCALE),
      debug: Math.round(val(2) * STATE_SCALE),
      ink: +val(3).toFixed(2),
      backdrop: +val(4).toFixed(3),
      busy: +val(5).toFixed(3),
    };
  }
  return { zone: -1, preset: -1, debug: -1, ink: -1, backdrop: -1, busy: -1 };
}

function shotQuiet(name) {
  mkdirSync(SHOTS, { recursive: true });
  adb(['shell', 'screencap', '-p', '/sdcard/vgshot.png']);
  adb(['pull', '/sdcard/vgshot.png', join(SHOTS, `${name}.png`)]);
}

/**
 * Кадры за окно. Единственная метрика, по которой можно судить: jank врёт — часть кадров у
 * приложения снята с учёта, и просадка 120 → 72 идёт при 0 % janky (docs/vireglass/README.md).
 * Рядом печатаются перцентили времени кадра и GPU: по ним видно, во что упёрлись.
 */
function frames(seconds = 6) {
  adb(['shell', 'dumpsys', 'gfxinfo', PKG, 'reset']);
  const t0 = Date.now();
  adb(['shell', 'sleep', String(seconds)]);
  const out = adb(['shell', 'dumpsys', 'gfxinfo', PKG]).toString();
  const pick = (re) => {
    const m = re.exec(out);
    return m ? m[1] : '?';
  };
  const total = Number(pick(/Total frames rendered: (\d+)/));
  const elapsed = (Date.now() - t0) / 1000;
  return {
    fps: total / elapsed,
    total,
    p50: pick(/50th percentile: (\d+)ms/),
    p90: pick(/90th percentile: (\d+)ms/),
    gpu50: pick(/50th gpu percentile: (\d+)ms/),
  };
}

function fps(seconds = 6) {
  const f = frames(seconds);
  console.log(
    `кадров ${f.total} — ${f.fps.toFixed(0)}/c, кадр p50 ${f.p50}мс p90 ${f.p90}мс, GPU p50 ${f.gpu50}мс`,
  );
}

/**
 * Прогон по сценам. Фон движется: на статике захват не перезаписывается и кадры не набираются.
 * Первая сцена — контроль без стекла, дальше растущее число поверхностей.
 */
function bench(seconds = 6) {
  const scenes = [
    ['контроль (без стекла)', ['stage=1', 'move=1', 'panel=0']],
    ['1 поверхность', ['stage=0', 'count=1', 'move=1', 'panel=0']],
    ['2 поверхности', ['stage=0', 'count=2', 'move=1', 'panel=0']],
    ['3 поверхности', ['stage=0', 'count=3', 'move=1', 'panel=0']],
    ['6 поверхностей', ['stage=0', 'count=6', 'move=1', 'panel=0']],
    ['продуктовый стек', ['stage=5', 'move=1', 'panel=0']],
  ];
  const rows = [];
  for (const [name, params] of scenes) {
    adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'vire://lab?${params.join('&')}'`]);
    adb(['shell', 'sleep', '2.5']);
    const f = frames(seconds);
    rows.push(
      `${name.padEnd(22)} ${f.fps.toFixed(0).padStart(3)}/c  кадр p50 ${String(f.p50).padStart(3)}мс p90 ${String(f.p90).padStart(3)}мс  GPU p50 ${f.gpu50}мс`,
    );
  }
  console.log(rows.join(String.fromCharCode(10)));
}

/**
 * Выставить состояние стенда диплинком: `set zone=11 preset=2 ior=1.7`.
 *
 * Тапами это делать нельзя. `input tap` приходит с опозданием и иногда теряется, и состояние
 * уезжает уже ПОСЛЕ того, как скрипт его сверил, — то есть замер идёт не над тем фоном.
 * Диплинк применяется атомарно и подтверждается меткой.
 */
function set(pairs) {
  const query = pairs.join('&');
  // URL уходит в ШЕЛЛ устройства, а там `&` разделяет команды: без кавычек до стенда
  // доезжает только первый параметр, и это выглядит как «диплинк применился частично».
  adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'vire://lab?${query}'`]);
  // Диплинк доезжает не мгновенно: onNewIntent → JS-событие → ре-рендер.
  adb(['shell', 'sleep', '1.6']);
  const state = readState();
  console.log(state);
  return state;
}

/** Подождать, пока адаптация устоится: полярность и оценка фона едут по времени, и замер
 *  сразу после смены зоны показывает переходное состояние, а не установившееся. */
function settle(seconds = 3) {
  adb(['shell', 'sleep', String(seconds)]);
  console.log(readState());
}

/**
 * Выставить состояние, ДОЖДАТЬСЯ подтверждения меткой и только потом снять кадр.
 *
 *   node scripts/glass-probe.mjs capture белое zone=11 preset=0
 *
 * Ждать обязательно. Диплинк доезжает через JS-мост и тяжёлый ре-рендер — до нескольких
 * секунд; снимок, сделанный раньше, показывает прежнюю зону, и такой замер выглядит
 * валидным (material-lab.md E-27, E-41).
 */
function capture(name, pairs) {
  const want = {};
  for (const pair of pairs) {
    const [k, v] = pair.split('=');
    if (['zone', 'preset', 'debug'].includes(k)) want[k] = Number(v);
  }
  adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'vire://lab?${pairs.join('&')}'`]);
  let state = null;
  for (let i = 0; i < 20; i++) {
    adb(['shell', 'sleep', '0.7']);
    state = readState();
    if (Object.entries(want).every(([k, v]) => state[k] === v)) break;
  }
  if (!Object.entries(want).every(([k, v]) => state[k] === v)) {
    throw new Error(`состояние не сошлось: хотели ${JSON.stringify(want)}, получили ${JSON.stringify(state)}`);
  }
  // Оценка фона и полярность едут по времени — снимок до их устаканивания это переходное
  // состояние, а не результат.
  adb(['shell', 'sleep', '2.5']);
  shotQuiet(name);
  console.log(readState());
}

/**
 * Прогон по всем зонам фона одним заходом.
 *
 * Единичный замер ничего не значит: стекло выглядит одинаково и когда оно чистое, и когда
 * ему нечего показать. Поэтому в каждой зоне меряется ПАРА — внутри стекла и на том же
 * участке экрана рядом, — и рядом же печатается решение автоматики.
 */
// Рамки задаются ДОЛЯМИ кадра, а не пикселями: у телефона и эмулятора разные и разрешение,
// и плотность, и стекло стоит в другом месте. Внутренняя рамка смещена вверх от центра —
// в центре лежит надпись, и её светлота исказила бы замер тела.
function sweepBoxes(png) {
  const w = png.width;
  const h = png.height;
  const cx = Math.round(w * 0.5);
  const cy = Math.round(h * 0.247);
  const box = Math.round(w * 0.1);
  return {
    inside: [cx - box / 2, cy - Math.round(w * 0.08) - box / 2, box, box].map(Math.round),
    outside: [cx + Math.round(w * 0.3) - box / 2, cy - box / 2, box, box].map(Math.round),
  };
}

function sweep(zones, extra = []) {
  const rows = [];
  for (const zone of zones) {
    capture(`sweep-${zone}`, [`zone=${zone}`, 'panel=0', ...extra]);
    const st = readState();
    const png = load(`sweep-${zone}`);
    const boxes = sweepBoxes(png);
    const one = (box) => {
      const [x, y, w, h] = box;
      const L = region(png, x, y, w, h);
      const dev = [];
      for (let j = 1; j < h - 1; j++) {
        for (let i = 1; i < w - 1; i++) {
          const c = L[j * w + i];
          const a = (L[(j - 1) * w + i] + L[(j + 1) * w + i] + L[j * w + i - 1] + L[j * w + i + 1]) / 4;
          dev.push(Math.abs(c - a));
        }
      }
      let clipped = 0;
      for (const v of L) if (v >= 254.5 || v <= 0.5) clipped++;
      return {
        luma: L.reduce((a, b) => a + b, 0) / L.length,
        noise: median(dev),
        clip: (clipped / L.length) * 100,
      };
    };
    const inside = one(boxes.inside);
    const outside = one(boxes.outside);
    rows.push(
      `${String(zone).padStart(2)}  фон ${outside.luma.toFixed(0).padStart(3)}  стекло ${inside.luma
        .toFixed(0)
        .padStart(3)}  Δ${(inside.luma - outside.luma).toFixed(0).padStart(4)}  шум ${inside.noise
        .toFixed(2)
        .padStart(5)}/${outside.noise.toFixed(2)}  упор ${inside.clip.toFixed(0).padStart(3)}%  ink ${st.ink}  замер ${st.backdrop} пестрота ${st.busy}`,
    );
  }
  console.log(rows.join(String.fromCharCode(10)));
}

const [cmd, ...rest] = process.argv.slice(2);
const n = (i) => Number(rest[i]);
if (cmd === 'shot') shot(rest[0]);
else if (cmd === 'crop') crop(rest[0], n(1), n(2), n(3), n(4), rest[5] ? n(5) : 1);
else if (cmd === 'stats') stats(rest[0], n(1), n(2), n(3), n(4));
else if (cmd === 'band') band(rest[0], n(1), n(2), n(3), n(4));
else if (cmd === 'tap') tap(rest[0], rest[1], rest[2] ? n(2) : 1);
else if (cmd === 'fps') fps(rest[0] ? n(0) : 6);
else if (cmd === 'bench') bench(rest[0] ? n(0) : 6);
else if (cmd === 'set') set(rest);
else if (cmd === 'settle') settle(rest[0] ? n(0) : 3);
else if (cmd === 'capture') capture(rest[0], rest.slice(1));
else if (cmd === 'sweep') sweep(rest[0] ? rest[0].split(',').map(Number) : [0, 1, 3, 4, 5, 8, 9, 10, 11, 12], rest.slice(1));
else if (cmd === 'state') console.log(readState());
else {
  console.error('shot|crop|stats|band|tap|fps|bench|set|settle|capture|state');
  process.exit(1);
}
