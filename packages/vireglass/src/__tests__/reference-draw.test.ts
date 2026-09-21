import { describe, expect, it } from 'vitest';

import {
  REFERENCE_SCENE_HEIGHT,
  REFERENCE_SCENE_WIDTH,
  REFERENCE_SURROUND,
  refCheckerCells,
  refGradientSteps,
  refGray,
  refGridPositions,
  refStripePositions,
  referenceScene,
} from '../reference-scene';
import { drawReferenceScene } from '../web/reference-draw';

/**
 * Восемь видов слоя рисует один и тот же `drawLayer` внутри `drawReferenceScene` — покрываем
 * его не «вызвался ли `fillRect`», а геометрией: числом прямоугольников, их границами и тем,
 * что они складываются в полотно без дыр и без лишнего нахлёста (кроме нахлёста, заложенного
 * нарочно — у шахматки и градиента, см. комментарии на месте).
 */
type FillCall = { readonly fillStyle: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number };

function fakeCtx(): { readonly ctx: CanvasRenderingContext2D; readonly calls: FillCall[] } {
  const calls: FillCall[] = [];
  let fillStyle = '';
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ fillStyle, x, y, w, h });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('рисование сверочного полотна · заливка', () => {
  it('одним прямоугольником на всё полотно', () => {
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('ровное'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });
    expect(calls).toEqual([
      { fillStyle: refGray(0.5), x: 0, y: 0, w: REFERENCE_SCENE_WIDTH, h: REFERENCE_SCENE_HEIGHT },
    ]);
  });
});

describe('рисование сверочного полотна · полосы', () => {
  it('фон плюс полосы с шагом полотна, ни одна не вылезает за край', () => {
    const layer = referenceScene('полосы').bands(0.5)[0].layer;
    if (layer.kind !== 'полосы') throw new Error('полотно «полосы» обязано быть полосами');
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('полосы'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });

    const [bg, ...stripes] = calls;
    expect(bg).toEqual({ fillStyle: refGray(0.5), x: 0, y: 0, w: REFERENCE_SCENE_WIDTH, h: REFERENCE_SCENE_HEIGHT });

    // Сверка платформ: канвас обязан класть ТЕ ЖЕ позиции, что отдаёт общий генератор — вьюхи
    // мобильной лаборатории берут их напрямую (`refStripePositions`), без своей арифметики.
    const expected = refStripePositions(layer, REFERENCE_SCENE_WIDTH);
    expect(stripes.map((c) => c.x)).toEqual(expected);
    for (const s of stripes) {
      expect(s.fillStyle).toBe(refGray(layer.other));
      expect(s.y).toBe(0);
      expect(s.w).toBe(layer.widthDp);
      expect(s.h).toBe(REFERENCE_SCENE_HEIGHT);
      expect(s.x + s.w).toBeLessThanOrEqual(REFERENCE_SCENE_WIDTH);
    }
  });

  it('плотность масштабирует и шаг, и позицию полос', () => {
    const layer = referenceScene('полосы').bands(0.5)[0].layer;
    if (layer.kind !== 'полосы') throw new Error('полотно «полосы» обязано быть полосами');
    const { ctx, calls } = fakeCtx();
    const d = 2;
    drawReferenceScene(ctx, referenceScene('полосы'), REFERENCE_SCENE_WIDTH * d, REFERENCE_SCENE_HEIGHT * d, {
      density: d,
      fit: 'во весь кадр',
    });
    const stripes = calls.slice(1);
    const expected = refStripePositions(layer, REFERENCE_SCENE_WIDTH).map((at) => at * d);
    expect(stripes.map((c) => c.x)).toEqual(expected);
    for (const s of stripes) expect(s.w).toBe(layer.widthDp * d);
  });
});

describe('рисование сверочного полотна · шахматка', () => {
  it('клетки тайлят полотно без пропусков, стороны точно 17 dp (шаг + 1 на шов)', () => {
    const layer = referenceScene('пёстрое').bands(0.5)[0].layer;
    if (layer.kind !== 'шахматка') throw new Error('полотно «пёстрое» обязано быть шахматкой');
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('пёстрое'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });

    const expected = refCheckerCells(layer, REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT);
    expect(calls.length).toBe(expected.length);
    expect(calls.map((c) => [c.x, c.y])).toEqual(expected.map((c) => [c.xDp, c.yDp]));
    for (const c of calls) {
      expect(c.w).toBe(layer.cellDp + 1);
      expect(c.h).toBe(layer.cellDp + 1);
      expect([refGray(layer.level - layer.amp), refGray(layer.level + layer.amp)]).toContain(c.fillStyle);
    }

    // Клетки покрывают всю ширину и высоту полотна, а не только целую часть решётки.
    const xs = new Set(calls.map((c) => c.x));
    const ys = new Set(calls.map((c) => c.y));
    expect(Math.max(...xs) + layer.cellDp).toBeGreaterThanOrEqual(REFERENCE_SCENE_WIDTH);
    expect(Math.max(...ys) + layer.cellDp).toBeGreaterThanOrEqual(REFERENCE_SCENE_HEIGHT);
  });
});

describe('рисование сверочного полотна · ступень', () => {
  it('делит полотно РОВНО пополам без дыры и без нахлёста', () => {
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('граница'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });
    expect(calls).toEqual([
      { fillStyle: refGray(0.03), x: 0, y: 0, w: REFERENCE_SCENE_WIDTH / 2, h: REFERENCE_SCENE_HEIGHT },
      { fillStyle: refGray(0.95), x: REFERENCE_SCENE_WIDTH / 2, y: 0, w: REFERENCE_SCENE_WIDTH / 2, h: REFERENCE_SCENE_HEIGHT },
    ]);
    // Стык левой и правой половины — это и есть граница: она обязана лежать посередине, а
    // не съезжать от ошибки вроде `w / 3` вместо `w / 2`.
    expect(calls[0].x + calls[0].w).toBe(calls[1].x);
    expect(calls[0].w + calls[1].w).toBe(REFERENCE_SCENE_WIDTH);
  });

  it('нечётная ширина: половины всё равно покрывают полотно без дыры', () => {
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('граница'), 337, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });
    expect(calls[0].w).toBe(337 / 2);
    expect(calls[1].x).toBe(calls[0].w);
    expect(calls[0].w + calls[1].w).toBe(337);
  });
});

describe('рисование сверочного полотна · черта', () => {
  it('черта стоит по центру заданной толщины', () => {
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('черта'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });
    expect(calls[0]).toEqual({
      fillStyle: refGray(0.93),
      x: 0,
      y: 0,
      w: REFERENCE_SCENE_WIDTH,
      h: REFERENCE_SCENE_HEIGHT,
    });
    expect(calls[1]).toEqual({ fillStyle: refGray(0.12), x: 0, y: 116, w: REFERENCE_SCENE_WIDTH, h: 20 });
    // Центр черты обязан совпасть с центром полотна — иначе она не по центру, а просто где-то.
    expect(calls[1].y + calls[1].h / 2).toBe(REFERENCE_SCENE_HEIGHT / 2);
  });

  it('толщина черты растёт с плотностью, положение остаётся по центру', () => {
    const { ctx, calls } = fakeCtx();
    const d = 3;
    drawReferenceScene(ctx, referenceScene('черта'), REFERENCE_SCENE_WIDTH * d, REFERENCE_SCENE_HEIGHT * d, {
      density: d,
      fit: 'во весь кадр',
    });
    const bar = calls[1];
    expect(bar.h).toBe(20 * d);
    expect(bar.y + bar.h / 2).toBe((REFERENCE_SCENE_HEIGHT * d) / 2);
  });
});

describe('рисование сверочного полотна · сетка', () => {
  it('фон плюс линии с постоянным шагом по обеим осям, включая дальний край', () => {
    const layer = referenceScene('сетка').bands(0.91)[0].layer;
    if (layer.kind !== 'сетка') throw new Error('полотно «сетка» обязано быть сеткой');
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('сетка'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });

    const vertical = refGridPositions(layer.stepDp, REFERENCE_SCENE_WIDTH);
    const horizontal = refGridPositions(layer.stepDp, REFERENCE_SCENE_HEIGHT);
    expect(calls.length).toBe(1 + vertical.length + horizontal.length);
    expect(calls[0]).toEqual({ fillStyle: refGray(0.91), x: 0, y: 0, w: REFERENCE_SCENE_WIDTH, h: REFERENCE_SCENE_HEIGHT });

    const vCalls = calls.slice(1, 1 + vertical.length);
    const hCalls = calls.slice(1 + vertical.length);
    expect(vCalls.map((c) => c.x)).toEqual(vertical);
    expect(hCalls.map((c) => c.y)).toEqual(horizontal);
    for (const c of [...vCalls, ...hCalls]) expect(c.fillStyle).toBe(refGray(layer.lineLevel));
  });

  it('линия остаётся ровно в один пиксель устройства при любой плотности', () => {
    const { ctx, calls } = fakeCtx();
    const d = 2.75;
    drawReferenceScene(ctx, referenceScene('сетка'), Math.round(REFERENCE_SCENE_WIDTH * d), Math.round(REFERENCE_SCENE_HEIGHT * d), {
      density: d,
      fit: 'во весь кадр',
    });
    // Половина плотности когда-то давала два пикселя вместо одного (см. комментарий в
    // reference-draw.ts) — тонкая сторона линии обязана остаться единицей на любой плотности.
    for (const c of calls.slice(1)) {
      const thin = Math.min(c.w, c.h);
      expect(thin).toBe(1);
    }
  });
});

describe('рисование сверочного полотна · градиент', () => {
  it('ступени градиента монотонны и без дыр покрывают всю высоту', () => {
    const layer = referenceScene('градиент').bands(0.5)[0].layer;
    if (layer.kind !== 'градиент') throw new Error('полотно «градиент» обязано быть градиентом');
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('градиент'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });

    const steps = refGradientSteps(layer);
    expect(calls.length).toBe(steps.length);
    expect(calls.map((c) => c.fillStyle)).toEqual(steps.map((s) => refGray(s)));

    // Монотонность в единицах светлоты 0..255, а не в строке hex — сравнивать строки можно
    // только потому, что уровни идут возрастанием, здесь декодируем явно.
    const levels = calls.map((c) => parseInt(c.fillStyle.slice(1, 3), 16));
    for (let i = 1; i < levels.length; i += 1) expect(levels[i]).toBeGreaterThan(levels[i - 1]);

    for (let i = 0; i < calls.length; i += 1) {
      expect(calls[i].x).toBe(0);
      expect(calls[i].w).toBe(REFERENCE_SCENE_WIDTH);
    }
    // Каждая следующая полоса начинается не дальше конца предыдущей — иначе градиент рвётся.
    for (let i = 1; i < calls.length; i += 1) expect(calls[i].y).toBeLessThanOrEqual(calls[i - 1].y + calls[i - 1].h);
    expect(calls[0].y).toBe(0);
    expect(calls[calls.length - 1].y).toBeLessThan(REFERENCE_SCENE_HEIGHT);
    expect(calls[calls.length - 1].y + calls[calls.length - 1].h).toBeGreaterThanOrEqual(REFERENCE_SCENE_HEIGHT);
  });
});

describe('рисование сверочного полотна · многополосная сцена «ступени»', () => {
  it('полосы стоят друг под другом БЕЗ дыр и в порядке сцены — проверяет накопление y между слоями', () => {
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('ступени'), REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT, {
      density: 1,
      fit: 'во весь кадр',
    });

    // 5 заливок + 2 прямоугольника ступени + 2 прямоугольника черты.
    expect(calls.length).toBe(9);
    const levels = [0.1, 0.3, 0.5, 0.69, 0.9];
    for (let i = 0; i < levels.length; i += 1) {
      expect(calls[i]).toEqual({ fillStyle: refGray(levels[i]), x: 0, y: i * 36, w: REFERENCE_SCENE_WIDTH, h: 36 });
    }
    expect(calls[5]).toEqual({ fillStyle: refGray(0.05), x: 0, y: 180, w: REFERENCE_SCENE_WIDTH / 2, h: 36 });
    expect(calls[6]).toEqual({ fillStyle: refGray(0.28), x: REFERENCE_SCENE_WIDTH / 2, y: 180, w: REFERENCE_SCENE_WIDTH / 2, h: 36 });
    expect(calls[7]).toEqual({ fillStyle: refGray(0.92), x: 0, y: 216, w: REFERENCE_SCENE_WIDTH, h: 36 });
    expect(calls[8]).toEqual({ fillStyle: refGray(0.12), x: 0, y: 231, w: REFERENCE_SCENE_WIDTH, h: 6 });
    // Последняя полоса обязана доходить точно до нижнего края полотна.
    expect(calls[8].y + calls[8].h).toBeLessThanOrEqual(REFERENCE_SCENE_HEIGHT);
    expect(calls[7].y + calls[7].h).toBe(REFERENCE_SCENE_HEIGHT);
  });
});

describe('рисование сверочного полотна · режим «полотно» (панель + поле окружения)', () => {
  it('панель стоит по центру площадки, вокруг — заливка окружения', () => {
    const { ctx, calls } = fakeCtx();
    drawReferenceScene(ctx, referenceScene('ровное'), 400, 400, { density: 1, fit: 'полотно' });

    expect(calls[0]).toEqual({ fillStyle: REFERENCE_SURROUND, x: 0, y: 0, w: 400, h: 400 });
    expect(calls[1]).toEqual({
      fillStyle: refGray(0.5),
      x: (400 - REFERENCE_SCENE_WIDTH) / 2,
      y: (400 - REFERENCE_SCENE_HEIGHT) / 2,
      w: REFERENCE_SCENE_WIDTH,
      h: REFERENCE_SCENE_HEIGHT,
    });
  });

  it('плотность масштабирует панель, центрирование пересчитывается вместе с ней', () => {
    const { ctx, calls } = fakeCtx();
    const d = 2;
    drawReferenceScene(ctx, referenceScene('ровное'), 800, 800, { density: d, fit: 'полотно' });

    expect(calls[1]).toEqual({
      fillStyle: refGray(0.5),
      x: (800 - REFERENCE_SCENE_WIDTH * d) / 2,
      y: (800 - REFERENCE_SCENE_HEIGHT * d) / 2,
      w: REFERENCE_SCENE_WIDTH * d,
      h: REFERENCE_SCENE_HEIGHT * d,
    });
  });
});
