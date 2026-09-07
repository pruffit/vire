// Витрина начертаний: одно и то же слово всеми гротесками, что есть у стенда.
//
// Смотреть шрифт списком имён бесполезно — выбирают его по СЛОВУ, которым будут набирать.
// Поэтому здесь «ПОТОК» в том же кегле и в том же верхнем регистре, в каком он стоит на кнопке,
// а рядом то же слово строчными: узкие гротески в двух регистрах ведут себя по-разному, и
// решать надо по обоим.
//
// Файлы объявлены в `public/rnd/index.html` и лежат рядом со стендом. Начертания кита (Oswald,
// Manrope, JetBrains Mono) взяты из тех же пакетов, что стоят в мобилке; остальные — срез
// кириллицы с зеркала fontsource. Новых зависимостей ни там, ни там не заведено.

import { tokens } from '@vire/design-tokens';
import { PHONE, phoneOrigin, phonePath, SCREEN_MARGIN } from './scenes';

export type Typeface = {
  family: string;
  weight: number;
  /** Чем это начертание отличается — короче имени и полезнее его. */
  note: string;
  /** Разрядка в пикселях: узким и плотным в верхнем регистре она обязательна. */
  tracking: number;
};

/**
 * Витринное начертание берётся ИЗ ТОКЕНА, а не выбирается здесь: им набираются заголовок
 * трека, строка песни и кнопка «ПОТОК» и в вебе, и на Android, и решение обязано быть одно.
 * Витрина ниже — инструмент выбора, а сам выбор живёт в `@vire/design-tokens`.
 */
export const DISPLAY_FACE: Typeface = {
  family: tokens.font.display.family,
  weight: tokens.font.display.weight,
  note: 'ВЫБРАНО для витринных надписей',
  tracking: tokens.font.display.tracking,
};

export const TYPEFACES: readonly Typeface[] = [
  { family: 'Oswald', weight: 600, note: 'узкий плакатный, кит мобилки', tracking: 1.6 },
  { family: 'Alumni Sans', weight: 800, note: 'высокий узкий, спортивный', tracking: 1.4 },
  { family: 'Cuprum', weight: 700, note: 'узкий газетный', tracking: 1.2 },
  { family: 'Russo One', weight: 400, note: 'широкий индустриальный', tracking: 0.6 },
  { family: 'Rubik Mono One', weight: 400, note: 'плакатный моноширинный', tracking: 0.2 },
  { family: 'Stalinist One', weight: 400, note: 'конструктивистский, очень характерный', tracking: 0.4 },
  { family: 'Tektur', weight: 700, note: 'гранёный техничный', tracking: 0.6 },
  { family: 'Exo 2', weight: 800, note: 'научно-фантастический', tracking: 0.8 },
  { family: 'Play', weight: 700, note: 'техно, компактный', tracking: 1 },
  DISPLAY_FACE,
  { family: 'Jost', weight: 700, note: 'геометрический, футуристический', tracking: 1 },
  { family: 'Geologica', weight: 700, note: 'современный, нейтральный', tracking: 0.8 },
  { family: 'Onest', weight: 800, note: 'современный русский гротеск', tracking: 0.8 },
  { family: 'Golos Text', weight: 700, note: 'русский нео-гротеск', tracking: 0.9 },
  { family: 'Commissioner', weight: 800, note: 'гуманистический', tracking: 0.9 },
  { family: 'Rubik', weight: 800, note: 'скруглённые углы', tracking: 0.8 },
  { family: 'Ruda', weight: 700, note: 'округлый, мягкий', tracking: 0.9 },
  { family: 'Manrope', weight: 800, note: 'нео-гротеск кита, тяжёлый', tracking: 0.8 },
  { family: 'JetBrains Mono', weight: 700, note: 'моноширинный кита', tracking: 0 },
];

/** Шрифты приходят файлами: до загрузки canvas молча рисует системным. */
export const loadTypefaces = (): Promise<unknown> =>
  Promise.all(TYPEFACES.map((t) => document.fonts.load(`${t.weight} 22px "${t.family}"`)));

export const fontOf = (t: Typeface, size: number) =>
  `${t.weight} ${size}px "${t.family}", system-ui, sans-serif`;

const ROW = 62;
const TOP = 64;
const BOTTOM = 28;
const WORD = 23;

export const typeScrollMax = (): number =>
  Math.max(TOP + TYPEFACES.length * ROW + BOTTOM - PHONE.height, 0);

/** Экран-витрина: слово каждым начертанием, под ним чем оно отличается. */
export function drawTypeSpecimen(
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
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  TYPEFACES.forEach((face, i) => {
    const top = TOP + i * ROW - scroll;
    // Строки за краем экрана не рисуются: их всё равно обрежет, а работа canvas на них тратится.
    if (top + ROW < 0 || top > PHONE.height) return;

    ctx.fillStyle = '#f2f4f8';
    ctx.font = fontOf(face, WORD);
    ctx.letterSpacing = `${face.tracking}px`;
    ctx.fillText('ПОТОК', SCREEN_MARGIN, top + 22);

    // То же слово строчными, справа и приглушённо: в верхнем регистре гротеск выглядит иначе,
    // чем в наборе, и выбирать по одному регистру — выбирать вслепую.
    ctx.fillStyle = '#7a8494';
    ctx.font = fontOf(face, 17);
    ctx.textAlign = 'right';
    ctx.fillText('Поток', PHONE.width - SCREEN_MARGIN, top + 22);
    ctx.textAlign = 'left';
    ctx.letterSpacing = '0px';

    ctx.fillStyle = '#616b7c';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`${face.family} ${face.weight} — ${face.note}`, SCREEN_MARGIN, top + 38);
  });

  // Заголовок рисуется ПОСЛЕ строк и на своей подложке: он не уезжает с прокруткой, а список
  // под ним уезжает, и без подложки строки проходили бы сквозь него.
  const head = ctx.createLinearGradient(0, 0, 0, 56);
  head.addColorStop(0, '#12151bff');
  head.addColorStop(0.72, '#12151bee');
  head.addColorStop(1, '#12151b00');
  ctx.fillStyle = head;
  ctx.fillRect(0, 0, PHONE.width, 56);
  ctx.fillStyle = '#7c8598';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.letterSpacing = '0.6px';
  ctx.fillText('ГРОТЕСКИ', SCREEN_MARGIN, 44);
  ctx.letterSpacing = '0px';

  ctx.restore();
}
