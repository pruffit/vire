'use client';

import { useCallback, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { JamQueueItem } from '@vire/core';
import { toast } from '@/lib/toast';

interface Args {
  code: string;
  sessionId: string | null;
  serverQueue: JamQueueItem[];
  setDragging: (dragging: boolean) => void;
}

export interface UseJamQueueResult {
  queue: JamQueueItem[];
  addTrack: (item: JamQueueItem) => Promise<void>;
  removeTrack: (itemId: string) => Promise<void>;
  startDrag: () => void;
  moveTrack: (activeId: string, overId: string) => Promise<void>;
  cancelDrag: () => void;
}

async function postQueue(code: string, sessionId: string | null, intent: Record<string, unknown>): Promise<Response | null> {
  return fetch(`/api/v1/jam/${encodeURIComponent(code)}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionId ? { ...intent, sessionId } : intent),
  }).catch(() => null);
}

/**
 * Локальный оверлей поверх серверной очереди useJamRoom: мутации применяются сразу,
 * откатываются при сетевой ошибке. Сбрасывается любым свежим serverQueue (наша
 * мутация подтвердилась эхом SSE, либо очередь поменял кто-то другой) — двух
 * источников правды не остаётся.
 */
export function useJamQueue({ code, sessionId, serverQueue, setDragging }: Args): UseJamQueueResult {
  const [overlay, setOverlay] = useState<JamQueueItem[] | null>(null);
  // Свежий serverQueue (эхо своей мутации или чужая правка) обесценивает оверлей —
  // подгоняем состояние во время рендера, не в эффекте (react-hooks/set-state-in-effect).
  const [syncedServerQueue, setSyncedServerQueue] = useState(serverQueue);
  if (serverQueue !== syncedServerQueue) {
    setSyncedServerQueue(serverQueue);
    setOverlay(null);
  }
  const queue = overlay ?? serverQueue;

  const addTrack = useCallback(async (item: JamQueueItem) => {
    const base = overlay ?? serverQueue;
    setOverlay([...base, item]);
    const res = await postQueue(code, sessionId, { kind: 'add', trackId: item.trackId });
    if (!res?.ok) {
      setOverlay(base);
      toast.error('Не удалось добавить трек');
    }
  }, [overlay, serverQueue, code, sessionId]);

  const removeTrack = useCallback(async (itemId: string) => {
    const base = overlay ?? serverQueue;
    setOverlay(base.filter((i) => i.id !== itemId));
    const res = await postQueue(code, sessionId, { kind: 'remove', itemId });
    if (!res?.ok) {
      setOverlay(base);
      toast.error('Не удалось убрать трек');
    }
  }, [overlay, serverQueue, code, sessionId]);

  const startDrag = useCallback(() => setDragging(true), [setDragging]);
  const cancelDrag = useCallback(() => setDragging(false), [setDragging]);

  const moveTrack = useCallback(async (activeId: string, overId: string) => {
    const base = overlay ?? serverQueue;
    const from = base.findIndex((i) => i.id === activeId);
    const to = base.findIndex((i) => i.id === overId);
    if (from < 0 || to < 0 || from === to) {
      setDragging(false);
      return;
    }
    const reordered = arrayMove(base, from, to);
    setOverlay(reordered);
    setDragging(false);

    const res = await postQueue(code, sessionId, { kind: 'move', itemId: activeId, toPosition: to });
    if (!res?.ok) {
      setOverlay(base);
      toast.error('Не удалось переставить трек');
    }
  }, [overlay, serverQueue, code, sessionId, setDragging]);

  return { queue, addTrack, removeTrack, startDrag, moveTrack, cancelDrag };
}
