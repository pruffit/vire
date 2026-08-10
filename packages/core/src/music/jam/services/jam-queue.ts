import type { JamQueueItemWrite } from '../repositories/jam';
import type { ExternalTrackRef } from '../../external/types/external';

export type QueueEntry = { source: 'VIRE'; trackId: string } | ExternalTrackRef;

export type QueueMutation =
  | { kind: 'add'; entry: QueueEntry; participantId: string; addedAt: Date }
  | { kind: 'remove'; itemId: string }
  | { kind: 'move'; itemId: string; toPosition: number }
  | { kind: 'shuffle'; random: () => number };

export function applyQueueMutation(
  items: JamQueueItemWrite[],
  mutation: QueueMutation,
): JamQueueItemWrite[] {
  switch (mutation.kind) {
    case 'add': {
      const shared = { addedByParticipantId: mutation.participantId, addedAt: mutation.addedAt };
      const item: JamQueueItemWrite = mutation.entry.source === 'VIRE'
        ? { ...shared, source: 'VIRE', trackId: mutation.entry.trackId, externalId: null, externalUrl: null, title: null, artistName: null, coverUrl: null, durationSec: null }
        : {
            ...shared,
            source: mutation.entry.source,
            trackId: null,
            externalId: mutation.entry.externalId,
            externalUrl: mutation.entry.externalUrl,
            title: mutation.entry.title,
            artistName: mutation.entry.artistName,
            coverUrl: mutation.entry.coverUrl,
            durationSec: mutation.entry.durationSec,
          };
      return [...items, item];
    }

    case 'remove': {
      // Несуществующий id — no-op: LWW, чужая мутация могла удалить элемент между чтением и записью.
      if (!items.some((item) => item.id === mutation.itemId)) return items;
      return items.filter((item) => item.id !== mutation.itemId);
    }

    case 'move': {
      const fromIndex = items.findIndex((item) => item.id === mutation.itemId);
      if (fromIndex === -1) return items;

      const toIndex = Math.max(0, Math.min(mutation.toPosition, items.length - 1));
      if (toIndex === fromIndex) return items;

      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved!);
      return next;
    }

    case 'shuffle': {
      // Fisher-Yates, random за интерфейсом — детерминируемо в тестах.
      const next = [...items];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(mutation.random() * (i + 1));
        [next[i], next[j]] = [next[j]!, next[i]!];
      }
      return next;
    }
  }
}

/**
 * Круговая очередь (режим PARTY): при добавлении находит позицию для newItem так, чтобы
 * трек гостя не встал раньше первого ещё не поставленного трека другого участника —
 * второй трек одного и того же гостя уходит в следующий «круг». Позиции на/до currentItemId
 * (уже играющая или сыгранная) не двигаются, но их участники уже «отыграли круг» — считаются
 * в базовом раунде хвоста, иначе трек текущего исполнителя не засчитывается ему в счёт.
 */
export function insertPartyQueueItem(
  items: JamQueueItemWrite[],
  newItem: JamQueueItemWrite,
  args: { addedByParticipantId: string | null; currentItemId: string | null },
): JamQueueItemWrite[] {
  const currentIndex = args.currentItemId ? items.findIndex((item) => item.id === args.currentItemId) : -1;
  const lockedCount = currentIndex + 1;
  const locked = items.slice(0, lockedCount);
  const future = items.slice(lockedCount);

  const baseRoundByParticipant = new Map<string | null, number>();
  for (const item of locked) {
    baseRoundByParticipant.set(item.addedByParticipantId, (baseRoundByParticipant.get(item.addedByParticipantId) ?? 0) + 1);
  }
  const baseRound = (key: string | null) => baseRoundByParticipant.get(key) ?? 0;

  let newRound = baseRound(args.addedByParticipantId);
  for (const item of future) {
    if (item.addedByParticipantId === args.addedByParticipantId) newRound++;
  }

  const seenInFuture = new Map<string | null, number>();
  let insertAt = future.length;
  for (let i = 0; i < future.length; i++) {
    const key = future[i]!.addedByParticipantId;
    const occurrence = seenInFuture.get(key) ?? 0;
    seenInFuture.set(key, occurrence + 1);
    if (baseRound(key) + occurrence > newRound) {
      insertAt = i;
      break;
    }
  }

  return [...locked, ...future.slice(0, insertAt), newItem, ...future.slice(insertAt)];
}
