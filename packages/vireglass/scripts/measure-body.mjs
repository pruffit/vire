#!/usr/bin/env node
/**
 * ОТКЛОНЕНИЕ ТЕЛА ОТ ФОНА — мера для сверки тонирования с эталоном.
 *
 * Меряет, насколько светлота тела детали уходит от той светлоты фона, которую тело закрывает.
 * У прозрачного стекла отклонение нулевое; у эталона оно отрицательное над светлым полотном и
 * положительное над тёмным (среда сжимает контраст к середине).
 *
 * ПОЧЕМУ ЭТО ЗДЕСЬ, А НЕ ОДНОРАЗОВЫМ СКРИПТОМ. Замеры этой серии восемь раз давали
 * неповторяемые числа, и каждый раз виновата была не оптика, а окно усреднения: чуть другой
 * ряд, чуть другой отступ от кромки — и вывод менялся на противоположный. Окно зафиксировано
 * здесь, чтобы два замера одной сцены сходились у разных людей.
 *
 * ПРАВИЛА ОКНА, без которых число ничего не значит:
 *   1. Фон берётся С ОБЕИХ сторон детали и под телом интерполируется линейно: у полотен есть
 *      собственный градиент, и на светлой половине он вчетверо больше измеряемого отклонения.
 *   2. Края детали выбрасываются (по умолчанию 15% ширины с каждой стороны): у кромки работают
 *      преломление, кромочный свет и отражение, и они не имеют отношения к телу.
 *   3. Ряд берётся один и тот же у обоих кадров и заведомо внутри детали по вертикали.
 *
 * Запуск:
 *   node scripts/measure-body.mjs <png> --row=430 --left=800 --right=1750 --in=980 --out=1580
 * где left/right — столбцы фона снаружи детали, in/out — границы детали по горизонтали.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const FFMPEG = process.env.VG_FFMPEG
  ?? 'C:/Users/KOTLAEV/vire/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg.exe';

const [src, ...rest] = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : Number(hit.slice(name.length + 3));
};

if (!src) {
  console.error('нужен путь к кадру: node scripts/measure-body.mjs <png> --row=… --left=… --right=… --in=… --out=…');
  process.exit(2);
}

const row = arg('row');
const left = arg('left');
const right = arg('right');
const inner = arg('in');
const outer = arg('out');
const trim = arg('trim', 0.15);
if ([row, left, right, inner, outer].some((v) => !Number.isFinite(v))) {
  console.error('нужны row, left, right, in, out');
  process.exit(2);
}

const x0 = Math.min(left, inner) - 2;
const width = Math.max(right, outer) - x0 + 3;
const tmp = `${src}.body.raw`;
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src, '-vf', `crop=${width}:1:${x0}:${row}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', tmp]);
const buf = fs.readFileSync(tmp);
fs.unlinkSync(tmp);

const lum = (x) => {
  const o = (x - x0) * 3;
  return 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2];
};

const backLeft = lum(left);
const backRight = lum(right);
const back = (x) => backLeft + ((backRight - backLeft) * (x - left)) / (right - left);

const span = outer - inner;
const from = Math.round(inner + span * trim);
const to = Math.round(outer - span * trim);
let sum = 0;
let n = 0;
let worst = 0;
for (let x = from; x <= to; x += 1) {
  const d = lum(x) - back(x);
  sum += d;
  n += 1;
  if (Math.abs(d) > Math.abs(worst)) worst = d;
}

console.log(
  `фон ${backLeft.toFixed(1)} → ${backRight.toFixed(1)}, тело по ${n} столбцам ` +
    `(середина ${Math.round(trim * 100)}% с краёв отброшена)`,
);
console.log(`отклонение тела от фона: среднее ${(sum / n).toFixed(1)}, наибольшее ${worst.toFixed(1)}`);
