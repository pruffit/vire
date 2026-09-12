import { describe, expect, it } from 'vitest';
import { mergeAccessibility } from '../design/accessibility';

const OFF = { reduceMotion: false, reduceTransparency: false };

describe('настройки доступности мобилки', () => {
  it('без системных настроек и тумблера материал не трогается', () => {
    expect(mergeAccessibility(OFF, false)).toEqual({
      reduceMotion: false,
      reduceTransparency: false,
      increaseContrast: false,
    });
  });

  // Тумблер кита может ужесточить настройку, но не отменить системную.
  it('тумблер приложения не ослабляет систему', () => {
    expect(mergeAccessibility({ ...OFF, reduceMotion: true }, false).reduceMotion).toBe(true);
    expect(mergeAccessibility(OFF, true).reduceMotion).toBe(true);
  });

  it('прозрачность идёт от системы', () => {
    expect(mergeAccessibility({ ...OFF, reduceTransparency: true }, false).reduceTransparency).toBe(true);
  });

  // У Android публичной настройки контраста нет — источника пока нет ни у одной платформы, кроме веба.
  it('контраст на мобилке пока не включается', () => {
    expect(mergeAccessibility({ reduceMotion: true, reduceTransparency: true }, true).increaseContrast).toBe(false);
  });
});
