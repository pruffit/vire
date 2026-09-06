import { describe, expect, it } from 'vitest';
import { createDeform } from '../touch-response';
import { activeMaterial, materialForInk, VIREGLASS_CONTROL_MATERIAL, VIREGLASS_MATERIAL } from '../material';

/** Прогнать отклик на N секунд шагами по кадру 60 Гц. */
function settle(d: ReturnType<typeof createDeform>, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) d.step(1 / 60);
}

describe('отклик на палец', () => {
  it('в покое всё в нулях и деталь считается успокоившейся', () => {
    const d = createDeform();
    expect(d.idle()).toBe(true);
    const s = d.sample();
    expect(s.pullX).toBe(0);
    expect(s.pullY).toBe(0);
    expect(s.press).toBe(0);
    expect(s.waveAmp).toBe(0);
  });

  it('касание запоминает ПЯТНО, а не центр детали: тянут там, где взяли', () => {
    const d = createDeform();
    d.grab(40, -12, 4);
    settle(d, 0.3);
    const s = d.sample();
    expect(s.touchX).toBeGreaterThan(20);
    expect(s.touchY).toBeLessThan(0);
  });

  it('тяга идёт ЗА пальцем и упирается в предел хода', () => {
    const d = createDeform();
    d.grab(0, 0, 0);
    d.drag(400, 0, 6);
    settle(d, 1);
    const s = d.sample();
    expect(s.pullX).toBeGreaterThan(0);
    expect(s.pullX).toBeLessThanOrEqual(6 + 1e-6);
  });

  it('тяга вправо НЕ уводит деталь влево: знак сохраняется', () => {
    const d = createDeform();
    d.grab(0, 0, 0);
    d.drag(-200, 0, 6);
    settle(d, 1);
    expect(d.sample().pullX).toBeLessThan(0);
  });

  it('после отпускания форма возвращается и почти без отскока', () => {
    const d = createDeform();
    d.grab(0, 0, 0);
    d.drag(300, 0, 6);
    settle(d, 0.6);
    const held = d.sample().pullX;
    d.release(0);
    // Полсекунды спустя возврат уже случился, и перелёт не превышает десятой доли хода:
    // густая среда возвращается быстро и не качается.
    settle(d, 0.5);
    const back = d.sample().pullX;
    expect(Math.abs(back)).toBeLessThan(Math.abs(held) * 0.1);
    // Полное успокоение наступает позже возврата формы: нажатие спадает своим темпом.
    settle(d, 1.5);
    expect(d.idle()).toBe(true);
  });

  it('нажатие нарастает и спадает, а не переключается', () => {
    const d = createDeform();
    d.grab(0, 0, 0);
    d.step(1 / 60);
    const early = d.sample().press;
    settle(d, 0.5);
    const full = d.sample().press;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(full);
    d.release(0);
    settle(d, 1);
    expect(d.sample().press).toBeLessThan(0.05);
  });

  it('волна гаснет за четверть секунды, а не качается', () => {
    const d = createDeform();
    d.grab(0, 0, 4);
    const start = d.sample().waveAmp;
    settle(d, 0.25);
    expect(start).toBeGreaterThan(0);
    expect(d.sample().waveAmp).toBeLessThan(start * 0.4);
  });

  it('шаг не зависит от частоты кадров: редкие кадры дают тот же итог', () => {
    const fast = createDeform();
    const slow = createDeform();
    fast.grab(0, 0, 0);
    slow.grab(0, 0, 0);
    fast.drag(200, 0, 6);
    slow.drag(200, 0, 6);
    for (let i = 0; i < 60; i += 1) fast.step(1 / 60);
    for (let i = 0; i < 15; i += 1) slow.step(1 / 15);
    expect(slow.sample().pullX).toBeCloseTo(fast.sample().pullX, 1);
  });
});

describe('материал органов управления', () => {
  it('толще и чище базового: орган управления — предмет, а не линза над фоном', () => {
    const c = VIREGLASS_CONTROL_MATERIAL;
    const b = VIREGLASS_MATERIAL;
    expect(c.bevel).toBeGreaterThan(b.bevel);
    expect(c.thickness).toBeGreaterThan(b.thickness);
    expect(c.ior).toBeGreaterThan(b.ior);
    expect(c.roughness).toBeLessThan(b.roughness);
    expect(c.presence).toBeGreaterThan(b.presence);
  });

  it('окружение и плёнка остаются базовыми: их роль от органа управления не зависит', () => {
    expect(VIREGLASS_CONTROL_MATERIAL.environment).toBe(VIREGLASS_MATERIAL.environment);
    expect(VIREGLASS_CONTROL_MATERIAL.film).toBe(VIREGLASS_MATERIAL.film);
  });

  it('деталь без краски не обязана разводить светлоту, с краской — обязана', () => {
    expect(materialForInk(VIREGLASS_CONTROL_MATERIAL, false).legibility).toBe(0);
    expect(materialForInk(VIREGLASS_CONTROL_MATERIAL, true).legibility).toBeGreaterThan(0.9);
  });

  it('активность — это состояние СРЕДЫ: плотнее, толще, шире фаска, чище', () => {
    const off = activeMaterial(VIREGLASS_CONTROL_MATERIAL, 0);
    const on = activeMaterial(VIREGLASS_CONTROL_MATERIAL, 1);
    expect(off).toEqual(VIREGLASS_CONTROL_MATERIAL);
    expect(on.ior).toBeGreaterThan(off.ior);
    expect(on.thickness).toBeGreaterThan(off.thickness);
    expect(on.bevel).toBeGreaterThan(off.bevel);
    expect(on.roughness).toBeLessThan(off.roughness);
    expect(on.presence).toBeGreaterThan(off.presence);
  });

  it('активность НЕ трогает окружение: признак состояния не должен зависеть от фона', () => {
    expect(activeMaterial(VIREGLASS_CONTROL_MATERIAL, 1).environment).toBe(
      VIREGLASS_CONTROL_MATERIAL.environment,
    );
  });

  it('доля активности зажата: за пределами 0…1 состояние не растёт', () => {
    expect(activeMaterial(VIREGLASS_CONTROL_MATERIAL, 5)).toEqual(
      activeMaterial(VIREGLASS_CONTROL_MATERIAL, 1),
    );
    expect(activeMaterial(VIREGLASS_CONTROL_MATERIAL, -5)).toEqual(
      activeMaterial(VIREGLASS_CONTROL_MATERIAL, 0),
    );
  });
});
