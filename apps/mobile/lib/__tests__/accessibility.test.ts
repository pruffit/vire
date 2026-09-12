import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  events: new Map<string, (on: boolean) => void>(),
  removed: 0,
  flags: { motion: false, transparency: false, contrast: false },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => native.flags.motion,
    isReduceTransparencyEnabled: async () => native.flags.transparency,
    isHighTextContrastEnabled: async () => native.flags.contrast,
    isDarkerSystemColorsEnabled: async () => false,
    addEventListener: (name: string, cb: (on: boolean) => void) => {
      native.events.set(name, cb);
      return {
        remove: () => {
          native.removed += 1;
          native.events.delete(name);
        },
      };
    },
  },
}));

const { mergeAccessibility, subscribeToSystemAccessibility } = await import('../design/accessibility');

const OFF = { reduceMotion: false, reduceTransparency: false, increaseContrast: false };

beforeEach(() => {
  native.events.clear();
  native.removed = 0;
  native.flags = { motion: false, transparency: false, contrast: false };
});

describe('слияние настроек', () => {
  it('без системных настроек и тумблера материал не трогается', () => {
    expect(mergeAccessibility(OFF, false)).toEqual(OFF);
  });

  // Тумблер кита может ужесточить настройку, но не отменить системную.
  it('тумблер приложения не ослабляет систему', () => {
    expect(mergeAccessibility({ ...OFF, reduceMotion: true }, false).reduceMotion).toBe(true);
    expect(mergeAccessibility(OFF, true).reduceMotion).toBe(true);
  });

  it('прозрачность и контраст идут от системы', () => {
    const system = { reduceMotion: false, reduceTransparency: true, increaseContrast: true };
    expect(mergeAccessibility(system, false)).toEqual({ ...system, reduceMotion: false });
  });
});

describe('подписка на систему', () => {
  // Поверхностей на экране до десятка: своя подписка у каждой — лишние запросы к мосту.
  it('нативных слушателей заводит только первый читатель', () => {
    const first = subscribeToSystemAccessibility(() => {});
    const afterFirst = native.events.size;
    const second = subscribeToSystemAccessibility(() => {});
    expect(native.events.size).toBe(afterFirst);
    expect(afterFirst).toBe(3);
    first();
    second();
  });

  it('слушатели снимаются, когда ушёл последний читатель', () => {
    const first = subscribeToSystemAccessibility(() => {});
    const second = subscribeToSystemAccessibility(() => {});
    first();
    expect(native.removed).toBe(0);
    second();
    expect(native.removed).toBe(3);
    expect(native.events.size).toBe(0);
  });

  it('событие системы будит читателей', () => {
    const woken = vi.fn();
    const off = subscribeToSystemAccessibility(woken);
    native.events.get('reduceMotionChanged')?.(true);
    expect(woken).toHaveBeenCalled();
    off();
  });
});
