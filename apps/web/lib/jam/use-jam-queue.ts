'use client';

import { useCallback, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { JamQueueItem, TrackCandidate } from '@vire/core';
import { toast } from '@/lib/toast';

interface Args {
  code: string;
  sessionId: string | null;
  serverQueue: JamQueueItem[];
  setDragging: (dragging: boolean) => void;
}

/** Оптимистичный превью внешней позиции, пока сервер не резолвил её (без — плейсхолдер не показывается, только запрос идёт). */
export interface OptimisticExternalGuess {
  title: string;
  artistName: string;
  coverUrl: string | null;
  durationSec: number | null;
}

export type ExternalAddOutcome =
  | { outcome: 'added' }
  | { outcome: 'candidates'; candidates: TrackCandidate[] }
  | { outcome: 'error' };

export interface UseJamQueueResult {
  queue: JamQueueItem[];
  /** Позиции, которые сейчас резолвятся на сервере — в списке они помечены «ищем». */
  pendingIds: ReadonlySet<string>;
  addTrack: (item: JamQueueItem) => Promise<void>;
  addExternal: (input: string, guess: OptimisticExternalGuess | null) => Promise<ExternalAddOutcome>;
  /** Локальный файл устройства-колонки — не идёт через резолв-каскад, метаданные уже известны клиенту. */
  addLocal: (file: { id: string; title: string; durationSec: number | null }) => Promise<boolean>;
  removeTrack: (itemId: string) => Promise<void>;
  startDrag: () => void;
  moveTrack: (activeId: string, overId: string) => Promise<void>;
  cancelDrag: () => void;
  shuffleQueue: () => Promise<void>;
}

/** Локальное превью перемешивания — реальный порядок задаёт сервер эхом jam:queue. */
function localShuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

/** Сервер отвечает осмысленным текстом («Очередь переполнена», «Слишком много добавлений») — показываем его, а не общую заглушку. */
async function failureMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 429) return 'Слишком часто — подождите минуту';
  const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof data?.error === 'string' && data.error ? data.error : fallback;
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
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  // Свежий serverQueue (эхо своей мутации или чужая правка) обесценивает оверлей —
  // подгоняем состояние во время рендера, не в эффекте (react-hooks/set-state-in-effect).
  const [syncedServerQueue, setSyncedServerQueue] = useState(serverQueue);
  if (serverQueue !== syncedServerQueue) {
    setSyncedServerQueue(serverQueue);
    setOverlay(null);
  }
  const queue = overlay ?? serverQueue;

  // Внешние позиции (source !== 'VIRE') добавляются отдельным роутом (срез B/C) — этот путь только для каталога.
  const addTrack = useCallback(async (item: JamQueueItem) => {
    if (!item.trackId) return;
    const base = overlay ?? serverQueue;
    setOverlay([...base, item]);
    const res = await postQueue(code, sessionId, { kind: 'add', trackId: item.trackId });
    if (!res?.ok) {
      setOverlay(base);
      toast.error('Не удалось добавить трек');
    }
  }, [overlay, serverQueue, code, sessionId]);

  // Внешний/локальный ввод — полный каскад резолва на сервере (срез B): ссылка/текст → играбельная
  // позиция либо кандидаты на выбор. Плейсхолдер снимается сервером и подтверждением через SSE.
  const addExternal = useCallback(async (input: string, guess: OptimisticExternalGuess | null): Promise<ExternalAddOutcome> => {
    const base = overlay ?? serverQueue;
    const pendingId = `pending-ext-${Date.now()}`;
    if (guess) {
      setPendingIds((prev) => new Set(prev).add(pendingId));
      setOverlay([...base, {
        id: pendingId, source: 'YOUTUBE', trackId: null, externalId: null, externalUrl: null,
        position: base.length, addedByParticipantId: null, addedAt: new Date(),
        title: guess.title, durationSec: guess.durationSec, artistName: guess.artistName,
        artistSlug: null, releaseId: null, coverUrl: guess.coverUrl, accentColor: null,
        isExplicit: false, version: null, feat: null,
      }]);
    }

    const res = await fetch(`/api/v1/jam/${encodeURIComponent(code)}/queue/external`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { input, sessionId } : { input }),
    }).catch(() => null);

    const clearPending = (): void => setPendingIds((prev) => {
      if (!prev.has(pendingId)) return prev;
      const next = new Set(prev);
      next.delete(pendingId);
      return next;
    });
    // Откатываем по id, а не снимком очереди: пока летел запрос, рядом мог появиться
    // ещё один pending — снимок стёр бы и его.
    const dropPending = (): void => {
      setOverlay((prev) => prev?.filter((item) => item.id !== pendingId) ?? null);
      clearPending();
    };

    if (!res || !res.ok) {
      if (guess) dropPending();
      if (res) toast.error(await failureMessage(res, 'Не удалось добавить трек'));
      return { outcome: 'error' };
    }
    if (res.status === 200) {
      if (guess) dropPending();
      const data = (await res.json().catch(() => null)) as { candidates?: TrackCandidate[] } | null;
      return { outcome: 'candidates', candidates: data?.candidates ?? [] };
    }
    clearPending();
    return { outcome: 'added' };
  }, [overlay, serverQueue, code, sessionId]);

  const addLocal = useCallback(async (file: { id: string; title: string; durationSec: number | null }): Promise<boolean> => {
    const base = overlay ?? serverQueue;
    setOverlay([...base, {
      id: `pending-local-${Date.now()}`, source: 'LOCAL', trackId: null, externalId: file.id, externalUrl: null,
      position: base.length, addedByParticipantId: null, addedAt: new Date(),
      title: file.title, durationSec: file.durationSec, artistName: '',
      artistSlug: null, releaseId: null, coverUrl: null, accentColor: null,
      isExplicit: false, version: null, feat: null,
    }]);

    const res = await fetch(`/api/v1/jam/${encodeURIComponent(code)}/queue/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId
        ? { fileId: file.id, title: file.title, durationSec: file.durationSec, sessionId }
        : { fileId: file.id, title: file.title, durationSec: file.durationSec }),
    }).catch(() => null);

    if (!res?.ok) {
      setOverlay(base);
      toast.error('Не удалось добавить файл');
      return false;
    }
    return true;
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

  const shuffleQueue = useCallback(async () => {
    const base = overlay ?? serverQueue;
    if (base.length < 2) return;
    setOverlay(localShuffle(base));
    const res = await postQueue(code, sessionId, { kind: 'shuffle' });
    if (!res?.ok) {
      setOverlay(base);
      toast.error('Не удалось перемешать очередь');
    }
  }, [overlay, serverQueue, code, sessionId]);

  return { queue, pendingIds, addTrack, addExternal, addLocal, removeTrack, startDrag, moveTrack, cancelDrag, shuffleQueue };
}
