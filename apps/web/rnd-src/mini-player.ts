// Что приложение рисует НА стеклянной плашке. Слоя два, и они разные по природе.
//
// Одноканальная краска — название, имя артиста, значок плей/паузы — уходит в маску значков и
// живёт ВНУТРИ материала, как значки навигации: её ведёт нормаль фаски, поверх ложится блик, а
// цвет ей даёт полярность детали. Обложка цветная, маска её не несёт (шейдер читает один
// зелёный канал), поэтому она ложится отдельным слоем ПОВЕРХ стекла — ровно так же, как на
// Android поверх стеклянной вьюхи рисуются её дети.

import { paintCover, RECENT } from './content';
import { drawIcon, type IconName } from './icons';

export const PLAYER_ICONS: readonly IconName[] = ['vire-play', 'vire-pause'];

/**
 * Раскладка внутри плашки, в её собственных координатах от центра.
 *
 * Отступ держится ЗАМЕТНО МЕНЬШЕ ФАСКИ, и это законно: краску у кромки уводит её собственная
 * глубина, а она мала и от толщины стекла не зависит (`VG_INK_DEPTH` в surface-shader.ts).
 * Пока сдвиг считался долей фаски, на толстом стекле он доходил до восьми пикселей и тянул
 * обложку за габарит — лечилось это ростом плашки, то есть не лечилось.
 */
/** Обложка вписана в плашку с РАВНЫМ полем со всех сторон: 30 при высоте 48 даёт по девять
 *  сверху, снизу и слева. На 36 поля оставалось шесть, и обложка распирала плашку. */
const PAD = 9;
const COVER = 30;
const COVER_RADIUS = 8;
const TEXT_GAP = 12;
const PLAY_SIZE = 22;
const PLAY_HIT = 18;

/** Играет то, что первым стоит в недавнем: список и плашка обязаны говорить об одном треке. */
const TRACK = RECENT[0];

const playCenterX = (width: number) => width / 2 - PAD - 4 - PLAY_SIZE / 2;

export const hitPlay = (width: number, localX: number, localY: number): boolean =>
  Math.abs(localX - playCenterX(width)) <= PLAY_HIT && Math.abs(localY) <= PLAY_HIT;

/**
 * Краска плашки в маску значков. Маска — белым по ЧЁРНОМУ: шейдер читает форму зелёным
 * каналом, и сглаживание обязано жить в нём, а не в альфе.
 *
 * Имя артиста рисуется приглушённым СЕРЫМ, то есть меньшей плотностью краски, а не другим
 * цветом: цвет у детали один и берётся он от полярности — второй строке взять свой неоткуда.
 */
export function drawPlayerInk(
  ctx: CanvasRenderingContext2D,
  width: number,
  scale: number,
  playing: boolean,
): void {
  ctx.save();
  ctx.scale(scale, scale);
  const textLeft = -width / 2 + PAD + COVER + TEXT_GAP;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(TRACK.title, textLeft, -2);
  // Вторая строка приглушена, но НЕ ВДВОЕ. Серый 0.61 давал ей вдвое меньше краски, чем у
  // названия, и над проезжающим списком запаса не оставалось: чужая строка приходит сквозь
  // стекло на четверти своего контраста, и этого хватало, чтобы встать с ней вровень.
  // Второстепенность здесь держат кегль и цвет, а не полупрозрачность на грани фола.
  ctx.fillStyle = '#d2d2d2';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(TRACK.artist, textLeft, 13);
  ctx.translate(playCenterX(width), 0);
  drawIcon(ctx, playing ? 'vire-pause' : 'vire-play', PLAY_SIZE);
  ctx.restore();
}

/** Обложка играющего трека — единственное цветное на плашке, поэтому ложится ПОВЕРХ стекла:
 *  маска несёт один канал и краски не передаёт. */
export function drawCover(ctx: CanvasRenderingContext2D, width: number, scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-width / 2 + PAD, -COVER / 2);
  paintCover(ctx, COVER, COVER_RADIUS, TRACK.hue);
  ctx.restore();
}
