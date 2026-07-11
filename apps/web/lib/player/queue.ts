import type { PlayerTrack } from '@/store/player';

export type Repeat = 'off' | 'all' | 'one';

/** Режет `items` окном `limit` вокруг `index`, оставляя `windowBefore` элементов перед ним. */
export function sliceWindowAroundIndex<T>(
  items: T[],
  index: number,
  limit: number,
  windowBefore: number,
): { items: T[]; index: number } {
  if (items.length <= limit) {
    return { items, index: Math.max(0, index) };
  }
  const start = Math.max(0, index - windowBefore);
  return { items: items.slice(start, start + limit), index: index - start };
}

export const LIVE_QUEUE_LIMIT = 300;
const LIVE_QUEUE_WINDOW_BEFORE = 20;

/** Кап бесконечно растущей live-очереди волны; originalQueue режем той же логикой
 *  по позиции текущего трека — иначе shuffleOff() после обрезки терял бы согласованность. */
export function capLiveQueue(
  queue: PlayerTrack[],
  queueIndex: number,
  originalQueue: PlayerTrack[] | null,
): { queue: PlayerTrack[]; queueIndex: number; originalQueue: PlayerTrack[] | null } {
  if (queue.length <= LIVE_QUEUE_LIMIT) {
    return { queue, queueIndex, originalQueue };
  }

  const currentId = queue[queueIndex]?.id;
  const { items: cappedQueue, index: cappedIndex } = sliceWindowAroundIndex(
    queue,
    queueIndex,
    LIVE_QUEUE_LIMIT,
    LIVE_QUEUE_WINDOW_BEFORE,
  );

  let cappedOriginal = originalQueue;
  if (originalQueue && originalQueue.length > LIVE_QUEUE_LIMIT) {
    const originalIndex = currentId ? originalQueue.findIndex((t) => t.id === currentId) : -1;
    cappedOriginal = sliceWindowAroundIndex(
      originalQueue,
      originalIndex >= 0 ? originalIndex : 0,
      LIVE_QUEUE_LIMIT,
      LIVE_QUEUE_WINDOW_BEFORE,
    ).items;
  }

  return { queue: cappedQueue, queueIndex: cappedIndex, originalQueue: cappedOriginal };
}

/** Следующий индекс очереди с учётом повтора. null — очередь кончилась (repeat='one'
 *  сюда не попадает: залипание на одном треке обрабатывается отдельно в audio-engine). */
export function nextQueueIndex(queueIndex: number, queueLength: number, repeat: Repeat): number | null {
  if (queueIndex + 1 < queueLength) return queueIndex + 1;
  if (repeat === 'all' && queueLength > 0) return 0;
  return null;
}

/** Перестановка Фишера — Йетса. rand переопределим в тестах для детерминизма. */
export function fisherYates<T>(arr: T[], rand: () => number = Math.random): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Включение шаффла: текущий трек фиксируется первым, остаток честно перемешан. */
export function shuffleOn(
  queue: PlayerTrack[],
  currentIndex: number,
  rand: () => number = Math.random,
): { queue: PlayerTrack[]; index: number } {
  if (queue.length === 0) return { queue: [], index: 0 };

  const safeIndex = currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0;
  const current = queue[safeIndex];
  const rest = queue.filter((_, i) => i !== safeIndex);
  const shuffledRest = fisherYates(rest, rand);

  return { queue: [current, ...shuffledRest], index: 0 };
}

/** Выключение шаффла: восстанавливаем исходный порядок, индекс — позиция текущего трека. */
export function shuffleOff(
  original: PlayerTrack[],
  currentId: string,
): { queue: PlayerTrack[]; index: number } {
  const index = original.findIndex((t) => t.id === currentId);
  return { queue: original, index: index >= 0 ? index : 0 };
}

/** Убирает дубликаты по id, первое вхождение выигрывает. */
export function dedupeQueue(tracks: PlayerTrack[]): PlayerTrack[] {
  const seen = new Set<string>();
  const result: PlayerTrack[] = [];
  for (const t of tracks) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    result.push(t);
  }
  return result;
}
