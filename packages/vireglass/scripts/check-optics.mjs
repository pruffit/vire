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
 *   4. ПОДЪЁМ В СТЕКЛО. У детали, которая под пальцем поднимается, а не вдавливается
 *      (эталон §5), тень обязана ОТОЙТИ: подъём без зазора под деталью — не подъём.
 *   5. ПЁСТРОЕ ПОЛОТНО — С ДВУХ СТОРОН. Над обложкой деталь обязана и держать краску
 *      читаемой, и не стирать то, что под ней. Требования тянут в разные стороны и ломаются
 *      порознь: заливка спасает краску и убивает контент, отказ от заливки — наоборот.
 *   6. КРОМКА КОПИТ СОДЕРЖИМОЕ. У силуэта линза обязана собирать то, что лежит за кромкой,
 *      и раздувать его изображение — этим стекло и отличается от плёнки. Остальные пять
 *      обещаний смотрят в середину детали, где наклон нулевой и преломления нет вовсе,
 *      поэтому полосу у кромки не проверяет больше ничто.
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
 * Без прохода по диапазону светлоты (секунды вместо минут): ... check:optics -- --ink. Остаётся всё,
 * кроме первых двух обещаний: палец, подъём, пёстрое полотно и кромка.
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
/** Шагов по светлоте пёстрого полотна. Реже, чем по ровному: особенности между шагами тут нет. */
const BUSY_STEPS = 9;
/**
 * Насколько мягче обязана стать кромка краски под пальцем.
 *
 * Порог стоит ВЫШЕ того, что даёт одно только нажатие. Само вдавливание уже смягчает кромку:
 * деталь под пальцем светлеет и сдвигается на доли пикселя, и замер без расфокуса вовсе
 * (`VG_INK_DEFOCUS = 0`) показывает 32%. С расфокусом — 55%. Порог между ними: выключи
 * расфокус — и гейт падает, ради чего он и написан. Оба числа сняты этим же пробником.
 */
const MIN_INK_SOFTENING = 0.45;
/**
 * Насколько дальше обязана лечь тень у детали, поднимающейся в стекло, против вдавленной
 * кнопки при том же нажатии. Три точки, снятые этим же пробником: 109% с правилом, 55% при
 * вдвое ослабленном подъёме, ровно 0% с выключенным. Порог стоит ВЫШЕ половинного случая —
 * иначе ослабление вдвое проходило бы молча, а гейт ловил бы только полное отключение.
 */
const MIN_LIFT_SPREAD = 0.75;
/**
 * Контраст краски с телом рядом над пёстрым полотном, в единицах светлоты 0..255. Худшее
 * измеренное — 89; если считать требование читаемости от средней светлоты места, а не от
 * ближнего к краске края разброса (`VG_BUSY_EDGE` = 0), тот же замер даёт 50, и светлая
 * надпись тонет в светлом пятне обложки. Порог стоит между этими двумя числами.
 */
const MIN_INK_ON_BUSY = 70;
/**
 * Сколько светлоты обязано ОСТАТЬСЯ от структуры полотна внутри детали, там же. Худшее
 * измеренное — 40; при откате к прежним заливке и рассеянию (подложка 0.15/0.70, рассеяние
 * 0.35) остаётся 18, то есть обложку под стеклом замазывает. Порог между ними.
 */
const MIN_CONTENT_ON_BUSY = 28;
/**
 * Во сколько раз у кромки обязано раздуться изображение полосы, лежащей под деталью, против
 * её же ширины снаружи. Замер даёт 2.02; при прежней толщине среды, с которой деталь читалась
 * плёнкой, — 1.73. Порог между этими числами.
 *
 * Число привязано к этой сцене: раздув — отношение, и на полосе другой толщины или на детали
 * другой формы оно другое. Сравнивать его с замерами по кадрам эталона нельзя, это страховка
 * от возврата к тонкому стеклу, а не сверка с Apple.
 */
const MIN_EDGE_GAIN = 1.88;

const ENTRY = `
import { createVireGlassRenderer, drawReferenceScene } from '${WEB}';
import {
  capsuleGeometry,
  circleGeometry,
  INK_DARK,
  INK_LIGHT,
  materialForInk,
  referenceScene,
  resolveOptics,
  roundedRectGeometry,
  shouldInkBeLight,
  VIREGLASS_CONTROL_MATERIAL,
  VIREGLASS_MATERIAL,
} from '${CORE}';

// ПОЛОТНА ОБЩИЕ СО СТЕНДАМИ. Раньше каждое из них жило прямо здесь, и получалось, что гейт
// меряет одно, а глаз на стенде смотрит на другое; расхождение находилось только случайно.
// Гейту полотно нужно во весь кадр (он снимает пиксели, поле окружения только мешает), стендам
// — панелью фиксированного размера; слои и их содержимое в dp одни и те же.
const canvasScene = (name, level, density = 1) => (ctx, w, h) =>
  drawReferenceScene(ctx, referenceScene(name), w, h, { density, level, fit: 'во весь кадр' });

// ВЫХОД В ЦИКЛ СОБЫТИЙ МЕЖДУ КАДРАМИ ОБЯЗАТЕЛЕН. Зонд читает сетку светлоты через PBO с
// забором, а забор в непрерывной синхронной петле не срабатывает никогда: сколько кадров ни
// рисуй, готового чтения не будет. Гейт тогда меряет ЗАПАСНОЙ путь шейдера (u_probeLuma = -1),
// а не тот, что работает в продукте, — и пороги настраиваются не на тот материал.
const settle = async (draw) => {
  for (let i = 0; i < 40; i += 1) {
    draw();
    await new Promise((r) => setTimeout(r, 0));
  }
};

let stage = null;

globalThis.vgProbe = async ({ level, striped, control }) => {
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

  const scene = canvasScene(striped ? 'полосы' : 'ровное', level);

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
  await settle(() => renderer.render({ density: 1, debug: 'normal', scene, pieces: [piece] }));

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
globalThis.vgInkProbe = async ({ press }) => {
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
  const scene = canvasScene('ровное', level);
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
    // Палец уведён в угол: локальное искажение поля до штриха не достаёт, а расфокус от
    // расстояния не зависит. Равномерная растяжка детали при нажатии остаётся — она и даёт
    // те 32%, ниже которых порог опускать нельзя. Радиус пятна тот же, что кладёт продукт.
    touch: { x: 104, y: 52, pullX: 0, pullY: 0, press, radius: 0.72 * 60, waveAmp: 0, wavePhase: 0 },
  };

  await settle(() => renderer.render({ density: 1, debug: 'normal', scene, pieces: [piece], iconMask: mask }));

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

  // Крайние значения строки нужны, чтобы считать крутизну В ДОЛЯХ перепада — само деление идёт
  // снаружи. Ширина штриха на полувысоте в счёт не входит: она показывает, не растянулось ли
  // поле, и печатается при провале, чтобы отличить размытие от растяжения.
  const lo = Math.min(...line);
  const hi = Math.max(...line);
  const half = (lo + hi) / 2;
  let width = 0;
  for (let i = 0; i < n; i += 1) if (line[i] > half) width += 1;
  return { sharp, lo, hi, width };
};

let rimStage = null;

// Шестое обещание: КРОМКА КОПИТ СОДЕРЖИМОЕ. Под деталью лежит полоса; её изображение меряется
// по столбцам шириной «масса, делённая на пик» — без порога, потому что у самой кромки полоса
// распадается на куски и любая граница по порогу перепрыгивает разрывы.
globalThis.vgRimProbe = async () => {
  // Плотность устройства, а не единица: толщина среды задана в dp, и на плотности 1 деталь
  // выходит вдвое мельче настоящей — полоса накопления у кромки тогда вдвое у́же.
  const D = 2;
  if (!rimStage) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    document.body.append(canvas);
    const renderer = createVireGlassRenderer(canvas);
    renderer.resize(canvas.width, canvas.height);
    rimStage = { canvas, renderer };
  }
  const { canvas, renderer } = rimStage;

  // Черта в 20 dp — та же пропорция к детали, что под эталонной ручкой. Пропорция входит в
  // определение замера: раздув это отношение, и на черте другой толщины число другое.
  const scene = canvasScene('черта', undefined, D);

  const optics = resolveOptics(materialForInk(VIREGLASS_CONTROL_MATERIAL, false));
  const piece = {
    optics,
    // Капсула, а не прямоугольник: у эталонной ручки полоса пересекает скруглённый торец,
    // и на прямой грани накопление у кромки выходит другим.
    geometry: capsuleGeometry(300, 110),
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    appear: 1,
  };
  await settle(() => renderer.render({ density: D, debug: 'normal', scene, pieces: [piece] }));

  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  // Капсула 300x110 dp при плотности 2 занимает 100..700 по горизонтали: окно начинается
  // снаружи неё и доходит до середины полосы накопления.
  const x0 = 40;
  const w = 160;
  const y0 = 100;
  const h = 200;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(x0, canvas.height - y0 - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const lum = (i) => 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2];

  // Ширина изображения полосы в столбце: масса темноты, делённая на её пик. У нетронутой
  // полосы она равна её толщине, у собранной кромкой — больше.
  const widthAt = (c) => {
    const col = [];
    for (let r = 0; r < h; r += 1) col.push(lum(r * w + c));
    const sorted = [...col].sort((a, b) => a - b);
    const base = sorted[sorted.length - 1];
    let mass = 0;
    let peak = 0;
    for (const v of col) {
      const t = base - v;
      if (t > 0) {
        mass += t;
        if (t > peak) peak = t;
      }
    }
    return peak > 4 ? mass / peak : 0;
  };

  let outside = 0;
  let best = 0;
  for (let c = 0; c < 40; c += 1) outside = Math.max(outside, widthAt(c));
  for (let c = 60; c < w; c += 1) best = Math.max(best, widthAt(c));
  return { outside, best, gain: outside > 1 ? best / outside : 0 };
};

let busyStage = null;

// Пятое обещание: НАД ПЁСТРЫМ ПОЛОТНОМ ЖИВУТ ОБА. Полотно — мозаика из плиток КРУПНЕЕ радиуса
// сбора: структуру мельче него стекло гасит по физике, и требовать её сохранения нельзя.
// Плитки раскладывает генератор, а не шахматный порядок: на периодическом полотне оценка
// разброса ловит собственный период и числа скачут от уровня к уровню.
// Контраст краски считается худшими краями — краска своим слабым, тело своим ближним к ней:
// надпись тонет там, где под ней оказалось светлое пятно, а не в среднем по детали.
globalThis.vgBusyProbe = async ({ level }) => {
  // СВОЙ рендерер, не общий: оценка окружения переносится между кадрами, и полотно в клетку,
  // пройдя через общий канвас, сбивало бы и свои числа, и замер тени у следующего обещания.
  if (!busyStage) {
    const canvas = document.createElement('canvas');
    canvas.width = 520;
    canvas.height = 300;
    document.body.append(canvas);
    const renderer = createVireGlassRenderer(canvas);
    renderer.resize(canvas.width, canvas.height);
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const m = mask.getContext('2d');
    m.fillStyle = '#000000';
    m.fillRect(0, 0, mask.width, mask.height);
    m.fillStyle = '#ffffff';
    m.fillRect(canvas.width / 2 - 3, canvas.height / 2 - 18, 6, 36);
    busyStage = { canvas, renderer, mask };
  }
  const { canvas, renderer } = busyStage;

  const scene = canvasScene('пёстрое', level);

  // Верхний край разброса берётся из самого полотна: амплитуду шахматки задаёт пакет, и
  // держать её второй копией здесь значит однажды разойтись с тем, что нарисовано.
  const amp = referenceScene('пёстрое').bands(level)[0].layer.amp;
  const light = shouldInkBeLight({ luma: level, hi: level + amp }, level < 0.5);
  const optics = resolveOptics({
    ...materialForInk(VIREGLASS_CONTROL_MATERIAL, true),
    ink: light ? INK_LIGHT : INK_DARK,
  });
  const v = light ? 1 : 0;
  const piece = {
    optics,
    geometry: roundedRectGeometry(220, 120, 32),
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    icon: true,
    appear: 1,
    inkIdle: [v, v, v, 1],
    inkActive: [v, v, v, 1],
  };
  await settle(() => renderer.render({ density: 1, debug: 'normal', scene, pieces: [piece], iconMask: busyStage.mask }));

  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  const W = 64;
  const H = 24;
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(canvas.width / 2 - W / 2, canvas.height / 2 - H / 2, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const lum = (i) => 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2];
  const glyph = [];
  const body = [];
  for (let r = 0; r < H; r += 1) {
    for (let c = 0; c < W; c += 1) {
      const dx = c - W / 2;
      if (Math.abs(dx) <= 2) glyph.push(lum(r * W + c));
      else if (Math.abs(dx) >= 6 && Math.abs(dx) <= 28) body.push(lum(r * W + c));
    }
  }
  const q = (a, p) => {
    const sorted = [...a].sort((x, y) => x - y);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  };
  return {
    contrast: light ? q(glyph, 0.1) - q(body, 0.9) : q(body, 0.1) - q(glyph, 0.9),
    content: q(body, 0.9) - q(body, 0.1),
  };
};

// Четвёртое обещание: ОРГАН, ПОДНИМАЮЩИЙСЯ В СТЕКЛО, ОТРЫВАЕТСЯ ОТ ПОДЛОЖКИ. Тень под ним
// обязана отойти дальше, чем под вдавленной кнопкой при том же нажатии. Меряется площадью
// потемнения в столбце под нижней кромкой детали на ровном светлом полотне.
globalThis.vgLiftProbe = async ({ lift }) => {
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

  const level = 0.78;
  const scene = canvasScene('ровное', level);
  const optics = resolveOptics({ ...materialForInk(VIREGLASS_CONTROL_MATERIAL, true), ink: INK_DARK });
  const piece = {
    optics,
    geometry: circleGeometry(56),
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    press: 1,
    lift,
  };

  await settle(() => renderer.render({ density: 1, debug: 'normal', scene, pieces: [piece] }));

  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  const rows = 46;
  const buf = new Uint8Array(rows * 4);
  // Столбец вниз от нижней кромки: в координатах GL отсчёт снизу, поэтому читаем ниже центра.
  gl.readPixels(canvas.width / 2, canvas.height / 2 - 28 - rows, 1, rows, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const ground = 255 * level;
  let area = 0;
  for (let i = 0; i < rows; i += 1) {
    const v = 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2];
    area += Math.max(ground - v, 0);
  }
  return area;
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
  let worstWindow = { value: Infinity, level: 0, name: '' };
  let worstPresence = { value: Infinity, level: 0, name: '' };

  // `--ink` гоняет только обещание про краску: проход по диапазону светлоты занимает минуты,
  // а правка краски его не задевает.
  const inkOnly = process.argv.includes("--ink");
  for (const { control, name } of inkOnly ? [] : [{ control: false, name: "кусок фона" }, { control: true, name: "орган управления" }]) {
  console.log(`--- ${name} ---`);
  for (let i = 0; i < STEPS; i += 1) {
    const level = 0.04 + (0.9 * i) / (STEPS - 1);
    const striped = await page.evaluate((a) => globalThis.vgProbe(a), { level, striped: true, control });
    const flat = await page.evaluate((a) => globalThis.vgProbe(a), { level, striped: false, control });

    const transmission = spread(striped.inside) / Math.max(spread(striped.outside), 1e-6);
    // Отход считается В ОБЕ СТОРОНЫ: над светлым полотном деталь отходит ВНИЗ, и метрика,
    // смотрящая только на самое яркое, такую кромку не видит вовсе. Тело печатается рядом со
    // знаком: по наибольшему из трёх не видно ни чем деталь держится, ни куда уходит тело.
    const body = flat.inside[2] - flat.outside[2];
    const presence = Math.max(
      Math.abs(body),
      Math.abs(flat.rim[1] - flat.outside[2]),
      Math.abs(flat.rim[0] - flat.outside[2]),
    );
    if (transmission < worstWindow.value) worstWindow = { value: transmission, level, name };
    if (presence < worstPresence.value) worstPresence = { value: presence, level, name };

    const ok = transmission >= MIN_TRANSMISSION && presence >= MIN_PRESENCE;
    console.log(
      `${ok ? ' ' : '!'} полотно ${level.toFixed(2)}: окно ${(transmission * 100).toFixed(0)}%, ` +
        `предмет ${presence.toFixed(1)} (тело ${body >= 0 ? '+' : ''}${body.toFixed(0)})`,
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

  console.log('--- кромка копит содержимое ---');
  const rim = await page.evaluate(() => globalThis.vgRimProbe());
  console.log(
    `${rim.gain >= MIN_EDGE_GAIN ? ' ' : '!'} полоса под деталью: снаружи ${rim.outside.toFixed(1)}, ` +
      `у кромки ${rim.best.toFixed(1)} — раздув ${rim.gain.toFixed(2)}x`,
  );
  if (!(rim.gain >= MIN_EDGE_GAIN)) {
    failed.push(`кромка не копит содержимое (раздув ${rim.gain.toFixed(2)}x)`);
  }

  console.log('--- пёстрое полотно ---');
  let worstInk = { value: Infinity, level: 0 };
  let worstContent = { value: Infinity, level: 0 };
  for (let i = 0; i < BUSY_STEPS; i += 1) {
    const level = 0.18 + (0.64 * i) / (BUSY_STEPS - 1);
    // Плитка и амплитуда заданы полотном «пёстрое» в пакете: плитка крупнее радиуса сбора, а
    // амплитуда одна на всех шагах — иначе шаги не сравнить.
    const busy = await page.evaluate((a) => globalThis.vgBusyProbe(a), { level });
    if (busy.contrast < worstInk.value) worstInk = { value: busy.contrast, level };
    if (busy.content < worstContent.value) worstContent = { value: busy.content, level };
    const ok = busy.contrast >= MIN_INK_ON_BUSY && busy.content >= MIN_CONTENT_ON_BUSY;
    console.log(
      `${ok ? ' ' : '!'} полотно ${level.toFixed(2)}: краска ${busy.contrast.toFixed(0)}, ` +
        `контент ${busy.content.toFixed(0)}`,
    );
    if (!(busy.contrast >= MIN_INK_ON_BUSY)) {
      failed.push(`полотно ${level.toFixed(2)}: краска утонула в обложке (${busy.contrast.toFixed(0)})`);
    }
    if (!(busy.content >= MIN_CONTENT_ON_BUSY)) {
      failed.push(`полотно ${level.toFixed(2)}: обложку под деталью стёрло (${busy.content.toFixed(0)})`);
    }
  }

  console.log('--- подъём в стекло ---');
  const pressedDown = await page.evaluate((a) => globalThis.vgLiftProbe(a), { lift: 0 });
  const liftedUp = await page.evaluate((a) => globalThis.vgLiftProbe(a), { lift: 1 });
  const spread2 = pressedDown > 0 ? liftedUp / pressedDown - 1 : 0;
  console.log(
    `${spread2 >= MIN_LIFT_SPREAD ? ' ' : '!'} тень под деталью: вдавлена ${pressedDown.toFixed(0)}, ` +
      `поднята ${liftedUp.toFixed(0)} — дальше на ${(spread2 * 100).toFixed(0)}%`,
  );
  if (!(spread2 >= MIN_LIFT_SPREAD)) {
    failed.push(`поднятая деталь не оторвалась от подложки (тень дальше всего на ${(spread2 * 100).toFixed(0)}%)`);
  }

  await browser.close();

  console.log(
    `худшее на пёстром: краска ${worstInk.value.toFixed(0)} на ${worstInk.level.toFixed(2)} ` +
      `(нужно ≥ ${MIN_INK_ON_BUSY}), контент ${worstContent.value.toFixed(0)} на ` +
      `${worstContent.level.toFixed(2)} (нужно ≥ ${MIN_CONTENT_ON_BUSY})`,
  );
  if (!inkOnly) console.log(
    `худшее: окно ${(worstWindow.value * 100).toFixed(0)}% на ${worstWindow.level.toFixed(2)} ` +
      `(${worstWindow.name}, нужно ≥ ${MIN_TRANSMISSION * 100}%), предмет ${worstPresence.value.toFixed(1)} ` +
      `на ${worstPresence.level.toFixed(2)} (${worstPresence.name}, нужно ≥ ${MIN_PRESENCE})`,
  );

  if (failed.length) {
    console.error(`check-optics: ${failed.join('; ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    'check-optics: стекло остаётся и окном, и предметом на всём диапазоне полотна, ' +
      'краска под пальцем уходит в расфокус, поднятая деталь отрывается от подложки, ' +
      'над пёстрым полотном живут и краска, и контент, кромка копит содержимое',
  );
}

await main();
