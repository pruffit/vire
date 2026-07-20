import type { JamQueueItemWrite } from '../repositories/jam';

export type QueueMutation =
  | { kind: 'add'; trackId: string; participantId: string; addedAt: Date }
  | { kind: 'remove'; itemId: string }
  | { kind: 'move'; itemId: string; toPosition: number };

export function applyQueueMutation(
  items: JamQueueItemWrite[],
  mutation: QueueMutation,
): JamQueueItemWrite[] {
  switch (mutation.kind) {
    case 'add':
      return [
        ...items,
        { trackId: mutation.trackId, addedByParticipantId: mutation.participantId, addedAt: mutation.addedAt },
      ];

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
  }
}
