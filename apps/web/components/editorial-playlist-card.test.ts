import { describe, expect, it } from 'vitest';
import { buildFan } from './editorial-playlist-card';

describe('buildFan', () => {
  it('три одинаковые обложки схлопываются в одну плоскую карточку', () => {
    const fan = buildFan(['a.jpg', 'a.jpg', 'a.jpg']);
    expect(fan).toHaveLength(1);
    expect(fan[0]).toMatchObject({ src: 'a.jpg', rot: 0, dx: 0 });
  });

  it('две уникальные из трёх дают веер из двух', () => {
    const fan = buildFan(['a.jpg', 'b.jpg', 'a.jpg']);
    expect(fan).toHaveLength(2);
    expect(fan.map((l) => l.src)).toEqual(expect.arrayContaining(['a.jpg', 'b.jpg']));
  });

  it('три+ уникальных дают полный веер из трёх, лицевая — первая', () => {
    const fan = buildFan(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    expect(fan).toHaveLength(3);
    const front = fan.find((l) => l.z >= 30);
    expect(front?.src).toBe('a.jpg');
  });

  it('пустой вход — пустой веер', () => {
    expect(buildFan([])).toEqual([]);
  });
});
