import { describe, expect, it } from 'vitest';
import {
  SURFACE_LENGTH_UNIFORMS,
  toDeviceSurfaceUniforms,
  toSurfaceUniforms,
} from '../adapters';
import { roundedRectGeometry } from '../geometry';
import { resolveOptics, VIREGLASS_MATERIAL } from '../material';

const optics = resolveOptics(VIREGLASS_MATERIAL);
const geometry = roundedRectGeometry(220, 120, 32);
const touch = { x: 12, y: -8, pullX: 4, pullY: 2, press: 1, radius: 40, waveAmp: 6, wavePhase: 0.25 };

const raw = () => toSurfaceUniforms(optics, geometry, { touch, shadow: 1 });

/**
 * Что именно является длиной — записано здесь ВТОРОЙ РАЗ намеренно. Возьми тест этот список из
 * самого модуля — и он станет проверять сам себя: удалённое из `SURFACE_LENGTH_UNIFORMS` поле
 * просто переедет в «безразмерные» и пройдёт проверку на равенство. Здесь список — ожидание,
 * и расходиться с ним нельзя молча: правка требует осознанной правки обеих сторон.
 */
const LENGTHS = [
  'u_halfSize',
  'u_corner',
  'u_bevel',
  'u_morphOffset',
  'u_morphHalf',
  'u_morphCorner',
  'u_morphK',
  'u_morph2Offset',
  'u_morph2Half',
  'u_morph2Corner',
  'u_shadowReach',
  'u_touch',
  'u_pull',
  'u_touchRadius',
] as const;

describe('перевод униформ поверхности в пиксели устройства', () => {
  // Контракт адаптера — dp: так его читает Android, где Skia рисует в тех же единицах.
  it('на плотности 1 не меняет ничего', () => {
    expect(toDeviceSurfaceUniforms(raw(), 1)).toEqual(raw());
  });

  it('длинами числятся ровно те поля, что перечислены здесь', () => {
    expect([...SURFACE_LENGTH_UNIFORMS].sort()).toEqual([...LENGTHS].sort());
  });

  it('длины домножаются, всё остальное остаётся как было', () => {
    const before = raw();
    const after = toDeviceSurfaceUniforms(before, 2);
    const lengths = new Set<string>([...LENGTHS, 'u_wave']);

    for (const [key, value] of Object.entries(before)) {
      if (lengths.has(key)) continue;
      expect(after[key as keyof typeof after], key).toEqual(value);
    }

    for (const key of LENGTHS) {
      const was = before[key];
      const now = after[key];
      if (Array.isArray(was)) {
        expect(now, key).toEqual((was as number[]).map((v) => v * 2));
      } else {
        expect(now, key).toBe((was as number) * 2);
      }
    }
  });

  // Радиус пятна — длина, и от него считается расфокус краски под пальцем (эталон §6). Потеряй
  // его здесь — и на плотном экране расплыв станет вдвое слабее, чем на Android: глазами это
  // видно только рядом с телефоном, а `check:optics` рендерит на плотности 1 и не заметит.
  it('радиус пятна касания — длина', () => {
    expect(SURFACE_LENGTH_UNIFORMS).toContain('u_touchRadius');
    expect(toDeviceSurfaceUniforms(raw(), 3).u_touchRadius).toBe(touch.radius * 3);
  });

  // У волны длина только амплитуда: фаза считается в оборотах и о плотности не знает.
  it('у волны масштабируется амплитуда, но не фаза', () => {
    const after = toDeviceSurfaceUniforms(raw(), 2);
    expect(after.u_wave[0]).toBe(touch.waveAmp * 2);
    expect(after.u_wave[1]).toBe(touch.wavePhase);
  });

  // Доли, светлоты и цвета плотности не знают — если такое поле уедет, материал поедет весь.
  it('безразмерные поля не трогаются', () => {
    const after = toDeviceSurfaceUniforms(raw(), 2);
    expect(after.u_thickness).toBe(raw().u_thickness);
    expect(after.u_touchPress).toBe(touch.press);
    expect(after.u_tint).toEqual(raw().u_tint);
  });
});
