// Контентный слой приложения: то, что страница рисует САМА, без стекла. Живёт в полотне, то
// есть ПОД линзами — стекло его преломляет, и ровно ради этого соседства лаборатория и нужна.
// Всё, что рисуется поверх стекла (краска на плашке, её обложка), лежит в `mini-player.ts`.

import { FLOW_MARK, MARK_STROKE, MARK_VIEWBOX } from '@vire/design-tokens/marks';
import { drawIcon, type IconName } from './icons';
import { DISPLAY_FACE, fontOf } from './typefaces';
import {
  concentricRadius,
  scrollEdgeStrength,
  scrollEdgeStyle,
} from 'vireglass';
import { PHONE, phoneOrigin, phonePath, SCREEN_MARGIN } from './scenes';
import { drawWithScrollEdges, type ScrollEdge } from './scroll-edge';

/** Транспорт экрана трека. Значки из системного спрайта, как и в навигации. */
export const TRANSPORT_ICONS: readonly IconName[] = [
  'vire-shuffle',
  'vire-skip-back',
  'vire-skip-forward',
  'vire-repeat',
  'vire-heart',
  'vire-share-2',
  'vire-chevron-down',
  'vire-align-center',
  'vire-more-horizontal',
];

function paintFlowIcon(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  ctx.save();
  ctx.scale(size / MARK_VIEWBOX, size / MARK_VIEWBOX);
  ctx.translate(-MARK_VIEWBOX / 2, -MARK_VIEWBOX / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = MARK_STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(FLOW_MARK));
  ctx.restore();
}

export type Track = { title: string; artist: string; length: string; hue: number };

/** Первый в списке — тот, что играет: мини-плеер показывает его же. */
export const RECENT: readonly Track[] = [
  { title: 'Тише воды', artist: 'Полина Ветрова', length: '3:42', hue: 268 },
  { title: 'Северный ветер', artist: 'Артур Гай', length: '4:05', hue: 208 },
  { title: 'Кинопробы', artist: 'Мята и Соль', length: '2:58', hue: 22 },
  { title: 'Стеклянный дом', artist: 'Rovesnik', length: '3:21', hue: 158 },
  { title: 'Не звони', artist: 'Лика Тарасова', length: '3:07', hue: 330 },
  { title: 'Пыль на пластинке', artist: 'Дом Советов', length: '4:38', hue: 44 },
  { title: 'Лето кончилось', artist: 'Ая и Волны', length: '3:15', hue: 190 },
  { title: 'Мимо кассы', artist: 'Гараж 17', length: '2:41', hue: 8 },
  { title: 'Сквозь помехи', artist: 'Нева Ретро', length: '3:54', hue: 288 },
  { title: 'Последний трамвай', artist: 'Ким Долгов', length: '4:12', hue: 120 },
];

/**
 * Радиус всего, что прилегает к углам экрана: обложка, кнопка «Поток», плашка мини-плеера.
 * Считается, а не подбирается: вложенные формы делят ЦЕНТР кривизны, иначе их углы идут не
 * параллельно углам экрана и поле между ними то съедается, то расходится (эталон §11).
 */
export const SCREEN_INNER_RADIUS = concentricRadius(PHONE.radius, SCREEN_MARGIN);

const ROW = 56;
const LIST_TOP = 58;
const COVER = 38;
const TEXT_GAP = 12;
/** Запас под списком, чтобы последний трек можно было вывести из-под плашки и навигации. */
const LIST_BOTTOM = 124;

/** Насколько список длиннее экрана — весь ход прокрутки. Ноль, если он и так помещается. */
export const recentScrollMax = (): number =>
  Math.max(LIST_TOP + RECENT.length * ROW + LIST_BOTTOM - PHONE.height, 0);

function roundedPath(ctx: CanvasRenderingContext2D, size: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(size, 0, size, size, radius);
  ctx.arcTo(size, size, 0, size, radius);
  ctx.arcTo(0, size, 0, 0, radius);
  ctx.arcTo(0, 0, size, 0, radius);
  ctx.closePath();
}

/** Обложка процедурная и одна на список и на плашку: в лаборатории проверяется соседство
 *  краски со стеклом, а не то, чья это пластинка. Рисуется от начала координат. */
export function paintCover(
  ctx: CanvasRenderingContext2D,
  size: number,
  radius: number,
  hue: number,
): void {
  ctx.save();
  roundedPath(ctx, size, radius);
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, `hsl(${hue + 24} 64% 62%)`);
  base.addColorStop(1, `hsl(${hue - 34} 58% 30%)`);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();
  const glow = ctx.createRadialGradient(size * 0.28, size * 0.24, 0, size * 0.28, size * 0.24, size * 0.8);
  glow.addColorStop(0, 'rgba(255,255,255,0.42)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = size * 0.067;
  ctx.beginPath();
  ctx.arc(size * 0.66, size * 0.74, size * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Отступ обложки от верха экрана. Большой намеренно: вся композиция экрана сдвинута ВНИЗ, к
 * руке. Группа управления и без того прибита к нижнему краю, и если обложку оставить у самого
 * верха, между ней и подписью открывается провал — воздух оказывается посреди экрана, где он
 * читается разрывом, а не воздухом. Пусто должно быть СВЕРХУ, над обложкой.
 */
const BIG_COVER_TOP = 100;
/** Отбивка подписи от обложки и расстояние между строками. */
/**
 * Блок под обложкой прибит К НИЗУ, а не к обложке.
 *
 * Он принадлежит кнопке «ПОТОК» и транспорту, а не картинке: подпись, полоса и органы
 * управления читаются как одна группа, и висеть она должна у нижнего края, где рука. Пока
 * отбивки считались от низа обложки, между транспортом и кнопкой оставалась дыра в шесть
 * десятков пикселей, а сама группа сидела посреди экрана без опоры.
 *
 * Свободное место при этом никуда не делось — оно ушло ПОД ОБЛОЖКУ, где ему и место: там оно
 * читается воздухом, а не разрывом.
 */
const BIG_ARTIST_GAP = 24;
/** Полоса прогресса и транспорт: отбивки от низа обложки. */
/** Отбивки внутри группы, снизу вверх: от кнопки к транспорту и дальше к подписи. */
const FLOW_TO_TRANSPORT = 38;
const TRANSPORT_TO_TIME = 42;
const TIME_TO_BAR = 20;
const BAR_TO_ARTIST = 24;
const BAR_HEIGHT = 4;
/** Размеры значков транспорта: главный крупнее, вспомогательные мельче и приглушены. */
const PLAY_SIZE = 34;
const SKIP_SIZE = 26;
const SIDE_SIZE = 19;
/** Действия над треком справа от подписи: лайк и «поделиться». */
const ACTION_SIZE = 21;
const ACTION_STEP = 34;
/** Верхняя панель: свернуть плеер слева, текст и «ещё» справа, в отступе над обложкой.
 *  Кнопки стеклянные — их рисует стенд поверх полотна, а не само полотно. */
export const TOP_BAR_Y = 52;
const FLOW_HEIGHT = 52;
/** Отбивка Потока от низа экрана: над индикатором домой. */
const FLOW_BOTTOM = 44;
/** Радиус тот же, что у обложки: кнопка — опора экрана, а не наклейка. */
const FLOW_RADIUS = SCREEN_INNER_RADIUS;

/** Секунды в «м:сс»: время слева считается от доли, справа стоит длина трека из данных. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function trackSeconds(length: string): number {
  const [m, s] = length.split(':').map(Number);
  return m * 60 + s;
}

/**
 * Экран трека: большая обложка и подпись под ней. Для материала это самый тяжёлый фон из всех,
 * что есть в стенде. Обложка цветная, яркая и занимает половину экрана: над ней стекло обязано
 * и остаться прозрачным, и удержать собственную надпись, а тело — не набрать её цвет целиком.
 *
 * Живёт в ПОЛОТНЕ, под линзами, как и список: это контент страницы, а не то, что лежит на
 * стекле. Оттенок берётся у играющего трека — экран и мини-плеер обязаны говорить об одном.
 *
 * Подпись выключена ВЛЕВО, по тому же полю экрана, что и обложка: край подписи и край обложки
 * стоят в одну вертикаль, иначе разнобой видно сразу.
 */
export function drawCoverScreen(
  ctx: CanvasRenderingContext2D,
  density: number,
  index: number,
  offsetX: number,
  offsetY: number,
  progress: number,
  playing: boolean,
): void {
  const px = density;
  const o = phoneOrigin(index);
  const size = PHONE.width - SCREEN_MARGIN * 2;
  const track = RECENT[0];

  ctx.save();
  phonePath(ctx, o.x * px + offsetX, o.y * px + offsetY, PHONE.width * px, PHONE.height * px, PHONE.radius * px);
  ctx.clip();
  ctx.translate(o.x * px + offsetX, o.y * px + offsetY);
  ctx.scale(px, px);
  ctx.translate(SCREEN_MARGIN, BIG_COVER_TOP);

  paintCover(ctx, size, SCREEN_INNER_RADIUS, track.hue);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f2f4f8';
  ctx.font = '600 22px system-ui, sans-serif';
  // Стопка считается СНИЗУ ВВЕРХ, от кнопки «ПОТОК»: она — опора группы.
  const flowTop = PHONE.height - BIG_COVER_TOP - FLOW_BOTTOM - FLOW_HEIGHT;
  const rowY = flowTop - FLOW_TO_TRANSPORT;
  const timeY = rowY - TRANSPORT_TO_TIME;
  const barY = timeY - TIME_TO_BAR;
  const artistY = barY - BAR_TO_ARTIST;
  const titleY = artistY - BIG_ARTIST_GAP;

  ctx.fillText(track.title, 0, titleY);
  ctx.fillStyle = '#98a1b2';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(track.artist, 0, artistY);

  // ДЕЙСТВИЯ НАД ТРЕКОМ — справа от подписи, по её середине, прижаты к тому же полю экрана,
  // что и обложка. Приглушены: подпись здесь главная, а лайк и «поделиться» рядом с ней —
  // спутники, и спорить с названием по силе они не должны.
  const actionY = titleY + BIG_ARTIST_GAP / 2 - 4;
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.translate(size - ACTION_SIZE / 2, actionY);
  drawIcon(ctx, 'vire-share-2', ACTION_SIZE);
  ctx.translate(-ACTION_STEP, 0);
  drawIcon(ctx, 'vire-heart', ACTION_SIZE);
  ctx.restore();

  // ПОЛОСА ПРОГРЕССА. Доля та же, что двигает подсветку на плашке мини-плеера: два места на
  // стенде показывают один трек, и разъезжаться им нельзя.
  const done = Math.min(Math.max(progress, 0), 1);

  const bar = (from: number, to: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(from, barY, Math.max(to - from, BAR_HEIGHT), BAR_HEIGHT, BAR_HEIGHT / 2);
    ctx.fill();
  };
  bar(0, size, '#39404f');
  bar(0, size * done, '#e6eaf2');

  const total = trackSeconds(track.length);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#8892a4';
  ctx.fillText(clock(total * done), 0, timeY);
  ctx.textAlign = 'right';
  ctx.fillText(track.length, size, timeY);
  ctx.textAlign = 'left';

  // ТРАНСПОРТ. Ряд симметричен относительно середины экрана, шаг между значками одинаков:
  // главный крупнее и в полную силу, вспомогательные мельче и приглушены — иерархия задаётся
  // размером и плотностью краски, а не рамками вокруг кнопок.
  const row = rowY;
  const step = size / 4.6;
  // Значки в спрайте белые, и красить их нечем — да и незачем: приглушение прозрачностью
  // и есть «меньше краски», ровно та же величина, которой отличаются строки на плашке.
  const controls: [IconName | 'play', number, number, number][] = [
    ['vire-shuffle', -step * 2, SIDE_SIZE, 0.5],
    ['vire-skip-back', -step, SKIP_SIZE, 0.85],
    ['play', 0, PLAY_SIZE, 1],
    ['vire-skip-forward', step, SKIP_SIZE, 0.85],
    ['vire-repeat', step * 2, SIDE_SIZE, 0.5],
  ];
  for (const [name, dx, iconSize, alpha] of controls) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(size / 2 + dx, row);
    drawIcon(ctx, name === 'play' ? (playing ? 'vire-pause' : 'vire-play') : name, iconSize);
    ctx.restore();
  }

  // ДВА ДЕЙСТВИЯ ПОД ТРАНСПОРТОМ. Ширина у них одинаковая, а вес — разный: текст это
  // второстепенное действие и берётся обводкой, Волна — главное и берётся заливкой. Различать
  // их размером было бы неверно: оба помещаются в строку и равны по площади, разной должна
  // быть только плотность.
  ctx.restore();
}

/** Габарит кнопки «ПОТОК»: её же берёт стеклянная деталь в раскладке стенда. */
export const FLOW_BUTTON = {
  width: PHONE.width - SCREEN_MARGIN * 2,
  height: FLOW_HEIGHT,
  radius: FLOW_RADIUS,
  /** На сколько центр кнопки поднят над нижним краем экрана. */
  lift: FLOW_BOTTOM + FLOW_HEIGHT / 2,
};

/**
 * Краска кнопки «ПОТОК». Уходит в маску и живёт ВНУТРИ материала — как краска мини-плеера и
 * значки навигации: её ведёт нормаль фаски, поверх ложится блик, а цвет даёт полярность детали.
 * Рисуется от ЦЕНТРА кнопки: маска собирается по раскладке, а не по координатам экрана.
 */
export function drawFlowInk(ctx: CanvasRenderingContext2D, scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';
  ctx.font = fontOf(DISPLAY_FACE, 19);
  ctx.letterSpacing = `${DISPLAY_FACE.tracking}px`;
  const word = ctx.measureText('ПОТОК').width;
  ctx.translate(-(word + 32) / 2 + 11, 0);
  paintFlowIcon(ctx, 21, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('ПОТОК', 23, 1);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

/**
 * Список недавнего на главном экране. Обычный UI: ни линз, ни маски — просто краска по
 * полотну. Отбит по тому же полю экрана, что кнопки и плашка, иначе края встают в столбик
 * и разнобой видно.
 *
 * Прокрутка своя, ЭКРАННАЯ: она двигает содержимое под неподвижным стеклом, тогда как
 * протяжка полотна возит по кадру весь телефон вместе с его линзами. Без обрезки по экрану
 * список вылезал бы на зону за рамкой телефона.
 */
function drawRecentList(
  ctx: CanvasRenderingContext2D,
  density: number,
  index: number,
  offsetX: number,
  offsetY: number,
  scroll: number,
): void {
  const px = density;
  const o = phoneOrigin(index);
  const x = o.x * px + offsetX;
  const y = o.y * px + offsetY;

  ctx.save();
  phonePath(ctx, x, y, PHONE.width * px, PHONE.height * px, PHONE.radius * px);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(px, px);
  ctx.translate(0, -scroll);
  ctx.textBaseline = 'alphabetic';

  RECENT.forEach((track, i) => {
    const mid = LIST_TOP + i * ROW + ROW / 2;
    // Строки за краем экрана не рисуются: обрезка их и так не покажет, а работа canvas на них
    // тратится — при десяти треках половина списка всегда снаружи.
    if (mid + ROW < scroll || mid - ROW > scroll + PHONE.height) return;
    ctx.save();
    ctx.translate(SCREEN_MARGIN, mid - COVER / 2);
    paintCover(ctx, COVER, 11, track.hue);
    ctx.restore();

    const left = SCREEN_MARGIN + COVER + TEXT_GAP;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e9ecf3';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(track.title, left, mid - 3);
    ctx.fillStyle = '#8892a4';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(track.artist, left, mid + 13);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#6b7484';
    ctx.fillText(track.length, PHONE.width - SCREEN_MARGIN, mid + 4);
    ctx.textAlign = 'left';
  });

  ctx.restore();
}

/** Полоса края сверху: статус-бар и заголовок, который над ней плавает. */
const TOP_EDGE = LIST_TOP + 12;
/** Полоса края снизу: зона плашки мини-плеера и навигации. */
const BOTTOM_EDGE = 170;
/** Верх фона приложения — в него растворяется контент у светлого стекла. */
const BACKDROP_FILL = '18,21,27';

const recentLayer = document.createElement('canvas');

/** Заголовок не едет со списком: он плавает над краем и обязан оставаться чистым (219 @9:22). */
function drawRecentHeader(
  ctx: CanvasRenderingContext2D,
  density: number,
  index: number,
  offsetX: number,
  offsetY: number,
): void {
  const o = phoneOrigin(index);
  ctx.save();
  phonePath(
    ctx,
    o.x * density + offsetX,
    o.y * density + offsetY,
    PHONE.width * density,
    PHONE.height * density,
    PHONE.radius * density,
  );
  ctx.clip();
  ctx.translate(o.x * density + offsetX, o.y * density + offsetY);
  ctx.scale(density, density);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7c8598';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('НЕДАВНЕЕ', SCREEN_MARGIN, 44);
  ctx.restore();
}

/**
 * Экран навигации целиком: список отдельным слоем и краевой эффект у обоих краёв. Стиль нижнего
 * края берётся у плашки мини-плеера — ближайшего стекла; сверху стекла нет, только светлый
 * заголовок, и край берёт тёмный стиль.
 */
export function drawRecentScreen(
  ctx: CanvasRenderingContext2D,
  density: number,
  index: number,
  offsetX: number,
  offsetY: number,
  scroll: number,
  maxScroll: number,
  glassInkLight: boolean,
): void {
  if (recentLayer.width !== ctx.canvas.width || recentLayer.height !== ctx.canvas.height) {
    recentLayer.width = ctx.canvas.width;
    recentLayer.height = ctx.canvas.height;
  }
  const layer = recentLayer.getContext('2d');
  if (!layer) return;
  layer.clearRect(0, 0, recentLayer.width, recentLayer.height);
  drawRecentList(layer, density, index, offsetX, offsetY, scroll);

  const o = phoneOrigin(index);
  const x = o.x * density + offsetX;
  const y = o.y * density + offsetY;
  const width = PHONE.width * density;
  const height = PHONE.height * density;
  const edges: ScrollEdge[] = [
    {
      x,
      y,
      width,
      height: TOP_EDGE * density,
      side: 'top',
      style: scrollEdgeStyle(true),
      fill: BACKDROP_FILL,
      strength: scrollEdgeStrength('top', scroll, maxScroll),
    },
    {
      x,
      y: y + height - BOTTOM_EDGE * density,
      width,
      height: BOTTOM_EDGE * density,
      side: 'bottom',
      style: scrollEdgeStyle(glassInkLight),
      fill: BACKDROP_FILL,
      strength: scrollEdgeStrength('bottom', scroll, maxScroll),
      // Затемнение у низа уже держит скрим экрана — у продукта это `FurnitureScrim`.
      veil: false,
    },
  ];
  ctx.save();
  phonePath(ctx, x, y, width, height, PHONE.radius * density);
  ctx.clip();
  drawWithScrollEdges(ctx, recentLayer, edges, density);
  ctx.restore();
  drawRecentHeader(ctx, density, index, offsetX, offsetY);
}
