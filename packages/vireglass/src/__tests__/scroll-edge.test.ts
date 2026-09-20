import { describe, expect, it } from 'vitest';
import { SCROLL_EDGE_ENGAGE_DP, scrollEdgeStrength, scrollEdgeStyle } from '../scroll-edge';

describe('краевой эффект прокрутки', () => {
  // Эталон 219 @9:28: тёмное стекло — лёгкое затемнение, светлое — растворение в фон.
  it('стиль идёт за стилем стекла', () => {
    expect(scrollEdgeStyle(true)).toBe('dim');
    expect(scrollEdgeStyle(false)).toBe('dissolve');
  });

  it('закреплённый вид под панелью получает ровную полосу', () => {
    expect(scrollEdgeStyle(true, true)).toBe('hard');
    expect(scrollEdgeStyle(false, true)).toBe('hard');
  });

  it('без прокрутки у верха эффекта нет', () => {
    expect(scrollEdgeStrength('top', 0, 400)).toBe(0);
    expect(scrollEdgeStrength('top', SCROLL_EDGE_ENGAGE_DP, 400)).toBe(1);
  });

  it('снизу эффект держится, пока контенту есть куда ехать', () => {
    expect(scrollEdgeStrength('bottom', 0, 400)).toBe(1);
    expect(scrollEdgeStrength('bottom', 400, 400)).toBe(0);
  });
});
