'use client';

import { useEffect, useRef } from 'react';

export type RealtimeEvent = { type: string } & Record<string, unknown>;
export type RealtimeHandlers = Partial<Record<string, (event: RealtimeEvent) => void>>;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15_000;
const DEFAULT_URL = '/api/v1/realtime/stream';

type HandlersRef = { current: RealtimeHandlers };

type Channel = {
  subscribers: Set<HandlersRef>;
  source: EventSource | null;
  reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  retryMs: number;
  everOpened: boolean;
};

// Один EventSource на URL на вкладку, сколько бы компонентов ни подписалось
// (колокольчик + LinkApprove + тред чата на общем стриме) — иначе по стриму на каждый хук.
const channels = new Map<string, Channel>();

function connect(url: string, ch: Channel) {
  ch.source = new EventSource(url);

  ch.source.onopen = () => {
    ch.retryMs = RECONNECT_BASE_MS;
    // Второй и последующие onopen — реконнект после разрыва: догрузка пропущенного
    // (чат/список диалогов) идёт по синтетическому '@reconnect', сервер такого не шлёт.
    if (ch.everOpened) {
      const reconnectEvent: RealtimeEvent = { type: '@reconnect' };
      for (const ref of ch.subscribers) ref.current['@reconnect']?.(reconnectEvent);
    }
    ch.everOpened = true;
  };

  ch.source.onmessage = (e: MessageEvent<string>) => {
    let payload: unknown;
    try {
      payload = JSON.parse(e.data);
    } catch {
      return;
    }
    if (!payload || typeof (payload as { type?: unknown }).type !== 'string') return;
    const event = payload as RealtimeEvent;
    for (const ref of ch.subscribers) ref.current[event.type]?.(event);
  };

  ch.source.onerror = () => {
    ch.source?.close();
    ch.source = null;
    if (ch.subscribers.size === 0) return;
    ch.reconnectTimer = setTimeout(() => {
      ch.reconnectTimer = undefined;
      connect(url, ch);
    }, ch.retryMs);
    ch.retryMs = Math.min(ch.retryMs * 2, RECONNECT_MAX_MS);
  };
}

// Вкладка вернулась в фокус (сон/бэкграунд мобильного таба рвёт TCP без onerror) —
// не ждать бэкофф, коннектиться сразу, если соединения нет.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    for (const [url, ch] of channels) {
      if (ch.source || ch.subscribers.size === 0) continue;
      if (ch.reconnectTimer) clearTimeout(ch.reconnectTimer);
      ch.reconnectTimer = undefined;
      ch.retryMs = RECONNECT_BASE_MS;
      connect(url, ch);
    }
  });
}

function subscribe(url: string, ref: HandlersRef): () => void {
  let ch = channels.get(url);
  if (!ch) {
    ch = { subscribers: new Set(), source: null, reconnectTimer: undefined, retryMs: RECONNECT_BASE_MS, everOpened: false };
    channels.set(url, ch);
  }
  ch.subscribers.add(ref);
  if (!ch.source && !ch.reconnectTimer) {
    ch.retryMs = RECONNECT_BASE_MS;
    connect(url, ch);
  }
  return () => {
    ch.subscribers.delete(ref);
    if (ch.subscribers.size === 0) {
      if (ch.reconnectTimer) clearTimeout(ch.reconnectTimer);
      ch.reconnectTimer = undefined;
      ch.source?.close();
      ch.source = null;
      channels.delete(url);
    }
  };
}

/**
 * Единый SSE-клиент: по умолчанию на `/api/v1/realtime/stream` (чат — `message`,
 * колокольчик — `notification`, привязка — `link-request`), опционально на произвольный
 * канал (джем). Диспатчит события по полю `type`. Реконнект с экспоненциальным бэкоффом.
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

  useEffect(() => subscribe(url, handlersRef), [url]);
}
