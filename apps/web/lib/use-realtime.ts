'use client';

import { useEffect, useRef } from 'react';

export type RealtimeEvent = { type: string } & Record<string, unknown>;
export type RealtimeHandlers = Partial<Record<string, (event: RealtimeEvent) => void>>;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15_000;

type HandlersRef = { current: RealtimeHandlers };

// Один EventSource на вкладку, сколько бы компонентов ни вызвали useRealtime
// (колокольчик + LinkApprove + тред чата) — иначе по стриму на каждый хук.
const subscribers = new Set<HandlersRef>();
let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let retryMs = RECONNECT_BASE_MS;

function connect() {
  source = new EventSource('/api/v1/realtime/stream');

  source.onopen = () => {
    retryMs = RECONNECT_BASE_MS;
  };

  source.onmessage = (e: MessageEvent<string>) => {
    let payload: unknown;
    try {
      payload = JSON.parse(e.data);
    } catch {
      return;
    }
    if (!payload || typeof (payload as { type?: unknown }).type !== 'string') return;
    const event = payload as RealtimeEvent;
    for (const ref of subscribers) ref.current[event.type]?.(event);
  };

  source.onerror = () => {
    source?.close();
    source = null;
    if (subscribers.size === 0) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, RECONNECT_MAX_MS);
  };
}

function subscribe(ref: HandlersRef): () => void {
  subscribers.add(ref);
  if (!source && !reconnectTimer) {
    retryMs = RECONNECT_BASE_MS;
    connect();
  }
  return () => {
    subscribers.delete(ref);
    if (subscribers.size === 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      source?.close();
      source = null;
    }
  };
}

/**
 * Единый SSE-клиент на `/api/v1/realtime/stream`: диспатчит события по полю `type`
 * (чат — `message`, колокольчик — `notification`, привязка — `link-request`).
 * Реконнект с экспоненциальным бэкоффом.
 */
export function useRealtime(handlers: RealtimeHandlers): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => subscribe(handlersRef), []);
}
