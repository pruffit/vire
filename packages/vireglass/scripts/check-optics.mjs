#!/usr/bin/env node
/**
 * Гейт на ГЛАВНЫЕ ОБЕЩАНИЯ МАТЕРИАЛА. Первые два нарушались молча и жили сутками: шейдер
 * компилируется, тесты зелёные, а на экране плашка вместо стекла.
 *
 *   1. ОКНО. Деталь обязана пропускать то, что под ней. Над полосатым полотном размах яркости
 *      ВНУТРИ детали — заметная доля размаха снаружи.
 *   2. ПРЕДМЕТ. Деталь обязана быть видна над РОВНЫМ полотном, иначе элемент управления
 *      исчезает: тело или кромка отходят от фона.
 *   3. КРАСКА ПОД ПАЛЬЦЕМ. Глиф обязан терять резкость на нажатии (эталон §6): без этого
 *      деталь под пальцем только светлеет, а краска остаётся приклеенной поверх стекла.
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
 * Только третье обещание (секунды вместо минут): ... check:optics -- --ink
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
/**
 * Насколько мягче обязана стать кромка краски под пальцем.
 *
 * Порог стоит ВЫШЕ того, что даёт одно только нажатие. Само вдавливание уже смягчает кромку:
 * деталь под пальцем светлеет и сдвигается на доли пикселя, и замер без расфокуса вовсе
 * (`VG_INK_DEFOCUS = 0`) показывает 32%. С расфокусом — 55%. Порог между ними: выключи
 * расфокус — и гейт падает, ради чего он и написан. Оба числа сняты этим же пробником.
 */
const MIN_INK_SOFTENING = 0.45;

const ENTRY = `
import { createVireGlassRenderer } from '${WEB}';
import {
  circleGeometry,
  INK_DARK,
  INK_LIGHT,
  materialForInk,
  resolveOptics,
  roundedRectGeometry,
  shouldInkBeLight,
  VIREGLASS_CONTROL_MATERIAL,
  VIREGLASS_MATERIAL,
} from '${CORE}';

const hex = (v) => {
  const b = Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0');
  return '#' + b + b + b;
};

let stage = null;

globalThis.vgProbe = ({ level, striped, control }) => {
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

  // Два случая, и оба обязательны. КУСОК ФОНА — базовый материал крупной деталью. ОРГАН
  // УПРАВЛЕНИЯ — стекло кнопок мелкой деталью и с краской поверх: оно толще, фаска у него шире
  // и на маленьком габарите упирается в потолок, то есть ведёт себя совсем иначе. Пока гейт
  // знал только первый случай, смена материала кнопок прошла мимо него целиком.
  const base = control ? materialForInk(VIREGLASS_CONTROL_MATERIAL, true) : VIREGLASS_MATERIAL;
  const light = shouldInkBeLight({ luma: level, hi: level }, level < 0.5);
  const optics = resolveOptics({ ...base, ink: light ? INK_LIGHT : INK_DARK });
  const geometry = control ? circleGeometry(56) : roundedRectGeometry(220, 120, 32);
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

  const halfW = control ? 12 : 60;
  // Внутри — плоская середина, мимо фаски. Снаружи — то же полотно выше детали. Кромка —
  // полоса по верхнему краю: над ровным фоном различимость может жить именно там.
  return {
    inside: row(canvas.height / 2, halfW),
    outside: row(canvas.height / 2 - 110, halfW),
    rim: row(canvas.height / 2 - (control ? 26 : 58), halfW),
  };
};

let inkStage = null;

// Третье обещание: КРАСКА ПОД ПАЛЬЦЕМ ТЕРЯЕТ РЕЗКОСТЬ. Меряется на штрихе поперёк: берётся
// строка через центр детали, резкость — самый крутой перепад между соседними пикселями.
globalThis.vgInkProbe = ({ press }) => {
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
  if (!inkStage) {
    // Маска краски: белый штрих по ЧЁРНОМУ, как того требует контракт кадра.
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#000000';
    mctx.fillRect(0, 0, mask.width, mask.height);
    mctx.fillStyle = '#ffffff';
    mctx.fillRect(canvas.width / 2 - 5, canvas.height / 2 - 18, 10, 36);
    inkStage = { mask };
  }
  const { mask } = inkStage;

  const level = 0.2;
  const scene = (ctx, w, h) => {
    ctx.fillStyle = hex(level);
    ctx.fillRect(0, 0, w, h);
  };
  const optics = resolveOptics({ ...materialForInk(VIREGLASS_CONTROL_MATERIAL, true), ink: INK_LIGHT });
  const piece = {
    optics,
    geometry: roundedRectGeometry(220, 120, 32),
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    icon: true,
    appear: 1,
    inkIdle: [1, 1, 1, 1],
    inkActive: [1, 1, 1, 1],
    // Палец уведён в угол детали: расфокус от расстояния не зависит (он идёт от силы нажатия и
    // размера пятна), а вот вдавливание — зависит, и мерить его заодно ни к чему. Радиус пятна
    // тот же, что кладёт продукт: доля половины меньшей стороны.
    touch: { x: 104, y: 52, pullX: 0, pullY: 0, press, radius: 0.72 * 60, waveAmp: 0, wavePhase: 0 },
  };

  for (let i = 0; i < 30; i += 1) {
    renderer.render({ density: 1, debug: 'normal', scene, pieces: [piece], iconMask: mask });
  }

  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  const n = 48;
  const buf = new Uint8Array(n * 4);
  gl.readPixels(canvas.width / 2 - n / 2, canvas.height / 2, n, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const line = [];
  for (let i = 0; i < n; i += 1) {
    line.push(0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2]);
  }

  let sharp = 0;
  for (let i = 1; i < n; i += 1) sharp = Math.max(sharp, Math.abs(line[i] - line[i - 1]));

  // Крутизна сама по себе меряет не только резкость: вдавливание растягивает поле, штрих
  // становится шире, и тот же переход раскладывается на большее число пикселей. Поэтому
  // крутизна умножается на ШИРИНУ штриха на полувысоте — растяжение сокращается, остаётся
  // именно размытие.
  const lo = Math.min(...line);
  const hi = Math.max(...line);
  const half = (lo + hi) / 2;
  let width = 0;
  for (let i = 0; i < n; i += 1) if (line[i] > half) width += 1;
  return { sharp, lo, hi, width };
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

  // `--ink` гоняет только обещание про краску: проход по диапазону светлоты занимает минуты,
  // а правка краски его не задевает.
  const inkOnly = process.argv.includes('--ink');
  for (const { control, name } of inkOnly ? [] : [{ control: false, name: "кусок фона" }, { control: true, name: "орган управления" }]) {
  console.log(`--- ${name} ---`);
  for (let i = 0; i < STEPS; i += 1) {
    const level = 0.04 + (0.9 * i) / (STEPS - 1);
    const striped = await page.evaluate((a) => globalThis.vgProbe(a), { level, striped: true, control });
    const flat = await page.evaluate((a) => globalThis.vgProbe(a), { level, striped: false, control });

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
      failed.push(`${name}, полотно ${level.toFixed(2)}: перестала быть окном`);
    }
    if (!(presence >= MIN_PRESENCE)) {
      failed.push(`${name}, полотно ${level.toFixed(2)}: пропала над ровным фоном`);
    }
  }
  }

  console.log('--- краска под пальцем ---');
  const idle = await page.evaluate((a) => globalThis.vgInkProbe(a), { press: 0 });
  const pressed = await page.evaluate((a) => globalThis.vgInkProbe(a), { press: 1 });
  // Крутизна кромки в долях полного перепада строки: под пальцем деталь светлеет, и абсолютная
  // крутизна падает даже без всякого размытия — делить обязательно, иначе меряется подсветка.
  const rel = (m) => m.sharp / Math.max(m.hi - m.lo, 1e-6);
  const sharpIdle = rel(idle);
  const sharpPressed = rel(pressed);
  const softening = sharpIdle > 0 ? 1 - sharpPressed / sharpIdle : 0;
  console.log(
    `${softening >= MIN_INK_SOFTENING ? ' ' : '!'} кромка штриха: покой ${sharpIdle.toFixed(1)}, ` +
      `под пальцем ${sharpPressed.toFixed(1)} — мягче на ${(softening * 100).toFixed(0)}%`,
  );
  if (!(softening >= MIN_INK_SOFTENING)) {
    console.log(`  покой ${JSON.stringify(idle)}, нажатие ${JSON.stringify(pressed)}`);
    failed.push(`краска под пальцем не ушла в расфокус (мягче всего на ${(softening * 100).toFixed(0)}%)`);
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
  console.log(
    'check-optics: стекло остаётся и окном, и предметом на всём диапазоне полотна, ' +
      'а краска под пальцем уходит в расфокус',
  );
}

await main();
