'use client';

import { useEffect, useRef } from 'react';

export type RealtimeEvent = { type: string } & Record<string, unknown>;
export type RealtimeHandlers = Partial<Record<string, (event: RealtimeEvent) => void>>;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15_000;
const DEFAULT_URL = '/api/v1/realtime/stream';

/**
 * Единый SSE-клиент: по умолчанию на `/api/v1/realtime/stream` (чат — `message`,
 * колокольчик — `notification`), опционально на произвольный канал (джем). Диспатчит
 * события по полю `type`. Реконнект с экспоненциальным бэкоффом.
 */
export function useRealtime(handlers: RealtimeHandlers): void;
export function useRealtime(url: string, handlers: RealtimeHandlers): void;
export function useRealtime(urlOrHandlers: string | RealtimeHandlers, maybeHandlers?: RealtimeHandlers): void {
  const url = typeof urlOrHandlers === 'string' ? urlOrHandlers : DEFAULT_URL;
  const handlers = typeof urlOrHandlers === 'string' ? (maybeHandlers ?? {}) : urlOrHandlers;

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = RECONNECT_BASE_MS;
    let stopped = false;

    function connect() {
      if (stopped) return;
      source = new EventSource(url);

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
        handlersRef.current[event.type]?.(event);
      };

      source.onerror = () => {
        source?.close();
        if (stopped) return;
        reconnectTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, RECONNECT_MAX_MS);
      };
    }

    connect();

    return () => {
      stopped = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [url]);
}
