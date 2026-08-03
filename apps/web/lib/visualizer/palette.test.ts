import { describe, expect, it } from 'vitest';
import { extractPalette, proxiedCoverUrl } from './palette';

function pixels(colors: Array<[number, number, number, number?]>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b, a], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a ?? 255;
  });
  return out;
}

describe('extractPalette', () => {
  it('возвращает доминирующий цвет обложки', () => {
    const data = pixels([
      [220, 40, 40], [225, 45, 35], [218, 38, 42],
      [30, 60, 200],
    ]);
    const palette = extractPalette(data);
    expect(palette.length).toBeGreaterThan(0);
    expect(palette[0]!.r).toBeGreaterThan(palette[0]!.b);
  });

  it('серое, чёрное и выбеленное в палитру не идут', () => {
    const data = pixels([
      [10, 10, 10], [250, 250, 250], [128, 128, 128], [240, 238, 242],
    ]);
    expect(extractPalette(data)).toEqual([]);
  });

  it('прозрачные пиксели игнорируются', () => {
    const data = pixels([[220, 40, 40, 0], [220, 40, 40, 10]]);
    expect(extractPalette(data)).toEqual([]);
  });

  it('не отдаёт больше запрошенного числа цветов', () => {
    const data = pixels([
      [220, 30, 30], [30, 220, 30], [30, 30, 220], [220, 220, 30], [220, 30, 220], [30, 220, 220],
    ]);
    expect(extractPalette(data, 3).length).toBeLessThanOrEqual(3);
  });

  it('пустой буфер не роняет', () => {
    expect(extractPalette(new Uint8ClampedArray(0))).toEqual([]);
  });
});

describe('proxiedCoverUrl', () => {
  it('внешнюю обложку заворачивает в /_next/image — иначе canvas «пачкается» и пиксели не прочесть', () => {
    expect(proxiedCoverUrl('https://cdn.viremusic.ru/covers/a.png')).toBe(
      '/_next/image?url=https%3A%2F%2Fcdn.viremusic.ru%2Fcovers%2Fa.png&w=64&q=50',
    );
  });

  it('уже проксированную не заворачивает повторно', () => {
    expect(proxiedCoverUrl('/_next/image?url=x&w=64&q=50')).toBe('/_next/image?url=x&w=64&q=50');
  });
});
