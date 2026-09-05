// Контентный слой приложения: то, что страница рисует САМА, без стекла. Живёт в полотне, то
// есть ПОД линзами — стекло его преломляет, и ровно ради этого соседства лаборатория и нужна.
// Всё, что рисуется поверх стекла (краска на плашке, её обложка), лежит в `mini-player.ts`.

import { PHONE, phoneOrigin, phonePath, SCREEN_MARGIN } from './scenes';

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

const ROW = 68;
const LIST_TOP = 66;
const COVER = 48;
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
 * Список недавнего на главном экране. Обычный UI: ни линз, ни маски — просто краска по
 * полотну. Отбит по тому же полю экрана, что кнопки и плашка, иначе края встают в столбик
 * и разнобой видно.
 *
 * Прокрутка своя, ЭКРАННАЯ: она двигает содержимое под неподвижным стеклом, тогда как
 * протяжка полотна возит по кадру весь телефон вместе с его линзами. Без обрезки по экрану
 * список вылезал бы на зону за рамкой телефона.
 */
export function drawRecentList(
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

  ctx.fillStyle = '#7c8598';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('НЕДАВНЕЕ', SCREEN_MARGIN, 44);

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
