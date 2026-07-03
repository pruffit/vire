import type { PlayerTrack } from '@/store/player';

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
