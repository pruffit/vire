import { useCallback, type RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { Skia, useFont, type SkCanvas, type SkFont } from '@shopify/react-native-skia';
import { FLOW_MARK, MARK_STROKE, MARK_VIEWBOX } from '@vire/design-tokens/marks';
import { LiquidGlassButton, inkStroke } from '../liquid-glass';
import { materialForInk, VIREGLASS_CONTROL_MATERIAL } from '../../lib/vireglass/material';
import { useMock, useMockMaterial } from '../../lib/design/mock';
import { Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';

/** Материал у всех деталей продукта ОДИН: роль показывают краска, размер и место, а не
 *  плотность стекла. Меняет материал только состояние — это делает ядро (`activeMaterial`). */
const FLOW_MATERIAL = materialForInk(VIREGLASS_CONTROL_MATERIAL, true);

/** Величины макета (`apps/web/rnd-src/content.ts`, `drawFlowInk`). Высота наружу: экран
 *  держит место кнопки распоркой, а саму кнопку рисует оверлеем над захватом. */
export const MOCK_FLOW_HEIGHT = 52;
const MOCK_RADIUS = 18;
const MOCK_MARK = 21;
const MOCK_LABEL = 19;
const MOCK_GAP = 12.5;
/** Трекинг витринного начертания: 0.4 px при кегле 19 (токен `font.display`). */
const TRACKING_RATIO = 0.4 / 19;

const LABEL = 'ПОТОК';

/**
 * «ПОТОК»: во всю ширину поля, запускает поток по текущему треку.
 *
 * Это КНОПКА ЯДРА, а не панель. Панель — поверхность: у неё нет ни тяги, ни отклика на
 * пятно касания, а краску она кладёт ПОВЕРХ стекла. Здесь знак и надпись печатаются в
 * маску и живут ВНУТРИ материала — их ведёт нормаль фаски, ровно как значки навигации и
 * краску мини-плеера. Одно и то же жидкое стекло на все три детали.
 */
export function FlowButton({
  onPress,
  blurTarget,
  width,
}: {
  onPress: () => void;
  blurTarget: RefObject<View | null> | null;
  /** Ширина поля экрана: кнопка занимает его целиком. */
  width: number;
}) {
  const ms = useMock();
  // Материал идёт ЧЕРЕЗ ТОТ ЖЕ МАСШТАБ, что и геометрия. Кнопка выросла в 1.37 раза, а
  // фаска оставалась макетной: она отдавала кромке меньшую долю полуразмера, и та читалась
  // тоньше и тусклее нарисованной — при том, что навигация и плашка масштаб уже держали.
  const material = useMockMaterial(FLOW_MATERIAL);
  const height = ms(MOCK_FLOW_HEIGHT);
  const label = ms(MOCK_LABEL);
  const mark = ms(MOCK_MARK);
  const gap = ms(MOCK_GAP);
  const font = useFont(Unbounded_800ExtraBold, label);

  const paintMask = useCallback(
    (canvas: SkCanvas, boxW: number, boxH: number) => {
      if (!font) return;
      drawFlowInk(canvas, boxW, boxH, font, { mark, gap, label });
    },
    [font, mark, gap, label],
  );

  return (
    <LiquidGlassButton
      size={height}
      width={width}
      radius={ms(MOCK_RADIUS)}
      paintMask={font ? paintMask : undefined}
      material={material}
      blurTarget={blurTarget}
      // Кнопка живёт НА экране плеера, а тот поднимает счётчик листов, чтобы погасить
      // таб-бар и мини-плеер под собой. Без этой отметки она гасла вместе с ними: линза
      // не рисовалась, и от стекла оставалась тёмная плашка без кромки.
      topLayer
      onPress={onPress}
    />
  );
}

/**
 * Краска кнопки — знак и надпись, отбитые от общего центра. Раскладка та же, что в вебе
 * (`drawFlowInk`): блок из знака, зазора и слова центрируется целиком, а не каждый сам по себе.
 */
function drawFlowInk(
  canvas: SkCanvas,
  boxW: number,
  boxH: number,
  font: SkFont,
  size: { mark: number; gap: number; label: number },
): void {
  const tracking = size.label * TRACKING_RATIO;
  const glyphs = font.getGlyphIDs(LABEL);
  const widths = font.getGlyphWidths(glyphs);
  const word = widths.reduce((sum, w) => sum + w, 0) + tracking * (glyphs.length - 1);

  const block = size.mark + size.gap + word;
  const left = (boxW - block) / 2;
  const middle = boxH / 2;

  const path = Skia.Path.MakeFromSVGString(FLOW_MARK);
  if (path) {
    const m = Skia.Matrix();
    const scale = size.mark / MARK_VIEWBOX;
    m.translate(left, middle - size.mark / 2);
    m.scale(scale, scale);
    path.transform(m);
    canvas.drawPath(path, inkStroke(MARK_STROKE * scale));
  }

  // Надпись — заливка, а не штрих: витринное начертание набрано телом буквы.
  const fill = Skia.Paint();
  fill.setColor(Skia.Color('white'));
  fill.setAntiAlias(true);
  // Базовая линия ставится по метрикам шрифта, а не по половине кегля: у витринного
  // начертания выносные элементы несимметричны, и «на глаз» слово уезжает вверх.
  const metrics = font.getMetrics();
  const baseline = middle - (metrics.ascent + metrics.descent) / 2;

  let x = left + size.mark + size.gap;
  for (let i = 0; i < glyphs.length; i += 1) {
    canvas.drawGlyphs([glyphs[i]], [{ x, y: baseline }], 0, 0, font, fill);
    x += widths[i] + tracking;
  }
}
