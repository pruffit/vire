import { describe, it, expect } from 'vitest';
import { fisherYates, shuffleOn, shuffleOff, dedupeQueue, nextQueueIndex, capLiveQueue, LIVE_QUEUE_LIMIT, insertIntoQueue } from './queue';

interface Track {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
}

function track(id: string): Track {
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

describe('nextQueueIndex', () => {
  it('середина очереди — просто следующий индекс', () => {
    expect(nextQueueIndex(1, 5, 'off')).toBe(2);
  });

  it('конец очереди + off → null', () => {
    expect(nextQueueIndex(4, 5, 'off')).toBeNull();
  });

  it('конец очереди + all → 0', () => {
    expect(nextQueueIndex(4, 5, 'all')).toBe(0);
  });

  it('пустая очередь → null', () => {
    expect(nextQueueIndex(0, 0, 'all')).toBeNull();
  });

  it('конец очереди + one → null (повтор трека не влияет на переход между треками)', () => {
    expect(nextQueueIndex(4, 5, 'one')).toBeNull();
  });
});

describe('capLiveQueue', () => {
  it('короткая очередь (<=LIVE_QUEUE_LIMIT) — не трогается', () => {
    const queue = Array.from({ length: 50 }, (_, i) => track(`t${i}`));
    const result = capLiveQueue(queue, 30, null);
    expect(result.queue).toEqual(queue);
    expect(result.queueIndex).toBe(30);
    expect(result.originalQueue).toBeNull();
  });

  it('длинная очередь режется, текущий трек остаётся на месте, index скорректирован', () => {
    const queue = Array.from({ length: 310 }, (_, i) => track(`t${i}`));
    const result = capLiveQueue(queue, 305, null);

    expect(result.queue.length).toBeLessThanOrEqual(LIVE_QUEUE_LIMIT);
    expect(result.queue[result.queueIndex]?.id).toBe('t305');
  });

  it('originalQueue (шаффл) режется согласованно по позиции текущего трека', () => {
    const queue = Array.from({ length: 310 }, (_, i) => track(`t${i}`));
    // originalQueue — тот же состав в другом порядке (шаффл), текущий трек t305 на позиции 10
    const originalQueue = [
      ...Array.from({ length: 10 }, (_, i) => track(`o${i}`)),
      track('t305'),
      ...Array.from({ length: 299 }, (_, i) => track(`o${i + 10}`)),
    ];

    const result = capLiveQueue(queue, 305, originalQueue);

    expect(result.queue.length).toBeLessThanOrEqual(LIVE_QUEUE_LIMIT);
    expect(result.originalQueue).not.toBeNull();
    expect(result.originalQueue!.length).toBeLessThanOrEqual(LIVE_QUEUE_LIMIT);
    expect(result.originalQueue!.some((t) => t.id === 't305')).toBe(true);
  });

  it('текущий трек отсутствует в originalQueue — фолбэк на позицию 0, не падает, queue/queueIndex согласованы', () => {
    const queue = Array.from({ length: 310 }, (_, i) => track(`t${i}`));
    // originalQueue не содержит t305 (рассинхрон данных) — findIndex вернёт -1
    const originalQueue = Array.from({ length: 310 }, (_, i) => track(`o${i}`));

    const result = capLiveQueue(queue, 305, originalQueue);

    expect(result.queue.length).toBeLessThanOrEqual(LIVE_QUEUE_LIMIT);
    expect(result.queue[result.queueIndex]?.id).toBe('t305');
    expect(result.originalQueue).not.toBeNull();
    expect(result.originalQueue!.length).toBeLessThanOrEqual(LIVE_QUEUE_LIMIT);
    // Фолбэк на index 0 — окно original начинается с его начала.
    expect(result.originalQueue![0]?.id).toBe('o0');
  });
});

describe('insertIntoQueue', () => {
  const t = (id: string) => track(id);
  const queue = [t('1'), t('2'), t('3')];

  it('next вставляет сразу после текущего', () => {
    const r = insertIntoQueue(queue, 0, [t('9')], 'next');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '9', '2', '3']);
    expect(r.inserted).toBe(1);
  });

  it('end добавляет в конец', () => {
    const r = insertIntoQueue(queue, 1, [t('9'), t('8')], 'end');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '2', '3', '9', '8']);
    expect(r.inserted).toBe(2);
  });

  it('уже стоящие в очереди не дублируются', () => {
    const r = insertIntoQueue(queue, 0, [t('2'), t('9')], 'next');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '9', '2', '3']);
    expect(r.inserted).toBe(1);
  });

  it('всё уже в очереди — inserted 0, очередь та же по ссылке', () => {
    const r = insertIntoQueue(queue, 0, [t('2')], 'next');
    expect(r.inserted).toBe(0);
    expect(r.queue).toBe(queue);
  });

  it('дубли внутри входа схлопываются', () => {
    const r = insertIntoQueue(queue, 2, [t('9'), t('9')], 'next');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '2', '3', '9']);
    expect(r.inserted).toBe(1);
  });
});
