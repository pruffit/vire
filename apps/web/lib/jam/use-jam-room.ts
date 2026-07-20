'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { JamParticipant, JamPlaybackState, JamQueueItem } from '@vire/core';
import { useRealtime, type RealtimeEvent } from '@/lib/use-realtime';

interface JamRoomState {
  queue: JamQueueItem[];
  version: number;
  participants: JamParticipant[];
  playback: JamPlaybackState | null;
  ended: boolean;
}

export interface UseJamRoomResult extends JamRoomState {
  connected: boolean;
  setDragging: (dragging: boolean) => void;
}

type JamSnapshotEvent = RealtimeEvent & {
  participants: JamParticipant[];
  queue: JamQueueItem[];
  version: number;
  playback: JamPlaybackState | null;
};
type JamQueueEvent = RealtimeEvent & { queue: JamQueueItem[]; version: number };
type JamPlaybackEvent = RealtimeEvent & { playback: JamPlaybackState };
type JamParticipantsEvent = RealtimeEvent & { participants: JamParticipant[] };

const INITIAL_STATE: JamRoomState = { queue: [], version: 0, participants: [], playback: null, ended: false };

export function useJamRoom(code: string, sessionId: string | null): UseJamRoomResult {
  const [state, setState] = useState<JamRoomState>(INITIAL_STATE);
  const [connected, setConnected] = useState(false);

  const versionRef = useRef(state.version);
  // React запрещает мутировать рефы во время рендера — синкаем в layout-эффекте (по образцу use-optimistic-toggle.ts)
  useLayoutEffect(() => {
    versionRef.current = state.version;
  }, [state.version]);

  const draggingRef = useRef(false);
  const pendingRef = useRef<{ queue: JamQueueItem[]; version: number } | null>(null);

  const applyQueue = useCallback((queue: JamQueueItem[], version: number) => {
    setState((prev) => ({ ...prev, queue, version }));
  }, []);

  const setDragging = useCallback(
    (dragging: boolean) => {
      draggingRef.current = dragging;
      if (dragging) return;
      const pending = pendingRef.current;
      pendingRef.current = null;
      // снапшот мог прийти во время drag и уже поднять версию — применяем отложенное, только если оно всё ещё свежее
      if (pending && pending.version > versionRef.current) applyQueue(pending.queue, pending.version);
    },
    [applyQueue],
  );

  const url = `/api/v1/jam/${encodeURIComponent(code)}/stream${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`;

  useRealtime(url, {
    'jam:snapshot': (event) => {
      const e = event as JamSnapshotEvent;
      pendingRef.current = null;
      setState({ queue: e.queue, version: e.version, participants: e.participants, playback: e.playback, ended: false });
      setConnected(true);
    },
    'jam:queue': (event) => {
      const e = event as JamQueueEvent;
      if (e.version <= versionRef.current) return;
      if (draggingRef.current) {
        pendingRef.current = { queue: e.queue, version: e.version };
        return;
      }
      applyQueue(e.queue, e.version);
    },
    'jam:playback': (event) => {
      const e = event as JamPlaybackEvent;
      setState((prev) => ({ ...prev, playback: e.playback }));
    },
    'jam:participants': (event) => {
      const e = event as JamParticipantsEvent;
      setState((prev) => ({ ...prev, participants: e.participants }));
    },
    'jam:ended': () => {
      setState((prev) => ({ ...prev, ended: true }));
    },
  });

  return { ...state, connected, setDragging };
}
