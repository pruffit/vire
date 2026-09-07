import { describe, it, expect } from 'vitest';
import { parseHex, luminance, resolveAccent, hueHex } from '../design/accent';
import { colors } from '../theme';

describe('акцент темы артиста', () => {
  it('читает обе формы записи и отбрасывает мусор', () => {
    expect(parseHex('#fff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex('#57C2A3')).not.toBeNull();
    expect(parseHex('rgb(1,2,3)')).toBeNull();
    expect(parseHex(null)).toBeNull();
  });

  it('яркость белого выше яркости чёрного', () => {
    expect(luminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1, 3);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 3);
  });

  it('без акцента экран остаётся на своей палитре', () => {
    const a = resolveAccent(null);
    expect(a.fill).toBe(colors.foreground);
    expect(a.wash).toBe(colors.secondary);
  });

  it('слишком тёмный акцент не идёт в заливку кнопки', () => {
    // Кнопка такого цвета сливалась бы с фоном — играть было бы нечем.
    expect(resolveAccent('#0a0a12').fill).toBe(colors.foreground);
  });

  it('на светлом акценте надпись тёмная, на насыщенном — светлая', () => {
    expect(resolveAccent('#ffe14d').ink).toBe(colors.background);
    expect(resolveAccent('#3b4cc0').ink).toBe(colors.foreground);
  });

  it('подложка карточки всегда темнее самого акцента', () => {
    const a = resolveAccent('#57c2a3');
    expect(luminance(parseHex(a.wash)!)).toBeLessThan(luminance(parseHex('#57c2a3')!));
  });

  // Светлоты сцены задаёт сама сцена (`components/haze-ground.tsx`), отсюда уезжает ТОЛЬКО
  // тон. Готовые роли поля были вдвое темнее вебовых, и экран уходил в почти-чёрное.
  it('в сцену уезжает тон, а не готовый цвет', () => {
    expect(resolveAccent('#57c2a3').hue).toBeCloseTo(163, 0);
    expect(resolveAccent(null).hue).toBeCloseTo(75, 0);
  });

  it('цвет по тону строится в HSL, а не смешиванием с чёрным', () => {
    // Смешивание обесцвечивает: у канала падает и светлота, и насыщенность.
    expect(hueHex(0, 0.7, 0.55)).toBe(hueHex(360, 0.7, 0.55));
    expect(luminance(parseHex(hueHex(163, 0.7, 0.55))!)).toBeGreaterThan(
      luminance(parseHex(hueHex(163, 0.7, 0.4))!),
    );
  });
});
