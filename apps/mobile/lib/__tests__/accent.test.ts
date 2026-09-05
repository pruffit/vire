import { describe, it, expect } from 'vitest';
import { parseHex, luminance, resolveAccent } from '../design/accent';
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
    expect(a.ground).toBe(colors.background);
  });

  it('слишком тёмный акцент не идёт в заливку кнопки', () => {
    // Кнопка такого цвета сливалась бы с фоном — играть было бы нечем.
    expect(resolveAccent('#0a0a12').fill).toBe(colors.foreground);
  });

  it('на светлом акценте надпись тёмная, на насыщенном — светлая', () => {
    expect(resolveAccent('#ffe14d').ink).toBe(colors.background);
    expect(resolveAccent('#3b4cc0').ink).toBe(colors.foreground);
  });

  it('фон всегда темнее самого акцента', () => {
    const a = resolveAccent('#57c2a3');
    expect(luminance(parseHex(a.ground)!)).toBeLessThan(luminance(parseHex('#57c2a3')!));
  });

  it('роли сцены: halo светлее base, base светлее deep, все темнее акцента', () => {
    const a = resolveAccent('#57c2a3');
    const accentLuma = luminance(parseHex('#57c2a3')!);
    const haloLuma = luminance(parseHex(a.halo)!);
    const baseLuma = luminance(parseHex(a.base)!);
    const deepLuma = luminance(parseHex(a.deep)!);

    expect(haloLuma).toBeGreaterThan(baseLuma);
    expect(baseLuma).toBeGreaterThan(deepLuma);
    expect(haloLuma).toBeLessThan(accentLuma);
    expect(baseLuma).toBeLessThan(accentLuma);
    expect(deepLuma).toBeLessThan(accentLuma);
  });

  it('нейтраль тоже красится ролями сцены — на тёплом хью, не на чистом сером', () => {
    const a = resolveAccent(null);
    expect(a.halo).not.toBe(a.base);
    expect(parseHex(a.base)).not.toEqual({ r: 0, g: 0, b: 0 });
  });
});
