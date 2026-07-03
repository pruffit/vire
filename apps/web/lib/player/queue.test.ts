import { describe, it, expect } from 'vitest';
import { fisherYates, shuffleOn, shuffleOff, dedupeQueue } from './queue';
import type { PlayerTrack } from '@/store/player';

function track(id: string): PlayerTrack {
  return { id, title: `title-${id}`, artistName: 'artist', coverUrl: null };
}

// Детерминированный rand: всегда возвращает j=0 в формуле Math.floor(rand() * (i + 1))
const zeroRand = () => 0;

describe('fisherYates', () => {
  it('сохраняет длину массива', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(fisherYates(arr)).toHaveLength(arr.length);
  });

  it('сохраняет состав элементов (мультимножество)', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const result = fisherYates(arr);
    expect([...result].sort()).toEqual([...arr].sort());
  });

  it('не мутирует исходный массив', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    fisherYates(arr);
    expect(arr).toEqual(copy);
  });

  it('детерминирован при подсунутом rand (rand=0 → циклический сдвиг к началу)', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(fisherYates(arr, zeroRand)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('пустой массив → пустой массив', () => {
    expect(fisherYates([])).toEqual([]);
  });

  it('массив из одного элемента → он же', () => {
    expect(fisherYates([42])).toEqual([42]);
  });
});

describe('shuffleOn', () => {
  it('текущий трек всегда первым, index=0', () => {
    const queue = [track('a'), track('b'), track('c'), track('d')];
    const { queue: result, index } = shuffleOn(queue, 2);
    expect(result[0].id).toBe('c');
    expect(index).toBe(0);
  });

  it('состав сохранён', () => {
    const queue = [track('a'), track('b'), track('c'), track('d')];
    const { queue: result } = shuffleOn(queue, 1);
    expect(result.map((t) => t.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('детерминирован при подсунутом rand', () => {
    const queue = [track('t0'), track('t1'), track('t2'), track('t3')];
    const { queue: result, index } = shuffleOn(queue, 1, zeroRand);
    expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't0']);
    expect(index).toBe(0);
  });

  it('пустая очередь → пустая очередь, index=0', () => {
    expect(shuffleOn([], 0)).toEqual({ queue: [], index: 0 });
  });

  it('один трек в очереди → он же, index=0', () => {
    const queue = [track('solo')];
    expect(shuffleOn(queue, 0)).toEqual({ queue: [track('solo')], index: 0 });
  });
});

describe('shuffleOff', () => {
  it('индекс указывает на позицию текущего трека в original', () => {
    const original = [track('a'), track('b'), track('c'), track('d')];
    const { queue: result, index } = shuffleOff(original, 'c');
    expect(result).toEqual(original);
    expect(index).toBe(2);
  });

  it('currentId отсутствует в original → индекс 0', () => {
    const original = [track('a'), track('b')];
    const { index } = shuffleOff(original, 'missing');
    expect(index).toBe(0);
  });

  it('пустая original → пустая очередь, index=0', () => {
    expect(shuffleOff([], 'x')).toEqual({ queue: [], index: 0 });
  });
});

describe('dedupeQueue', () => {
  it('убирает дубликаты по id, первый выигрывает', () => {
    const a1 = track('a');
    const b = track('b');
    const a2 = { ...track('a'), title: 'другой заголовок' };
    const result = dedupeQueue([a1, b, a2]);
    expect(result).toEqual([a1, b]);
    expect(result.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('без дубликатов — возвращает эквивалентный список', () => {
    const tracks = [track('a'), track('b'), track('c')];
    expect(dedupeQueue(tracks)).toEqual(tracks);
  });

  it('пустой список → пустой список', () => {
    expect(dedupeQueue([])).toEqual([]);
  });
});
