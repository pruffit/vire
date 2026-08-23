import { useEffect, useRef } from 'react';
import EventSource from 'react-native-sse';
import { API_BASE_URL } from './env';
import { getStored } from './secure-store';

export type ChatRealtimeEvent = { type: string } & Record<string, unknown>;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15_000;

// Типы событий, которые тред чата умеет отрисовать — остальные (notification/link-request) молча игнорируются.
const DISPATCHABLE_TYPES = new Set(['message', 'chat:typing', 'chat:read']);

// Чистая часть — парсинг + фильтрация payload'а, без сети, тестируется без EventSource.
export function parseChatRealtimeEvent(raw: string | null | undefined): ChatRealtimeEvent | null {
  if (!raw) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!payload || typeof (payload as { type?: unknown }).type !== 'string') return null;
  return payload as ChatRealtimeEvent;
}

// Чистая часть — какие типы событий достойны диспатча в onMessage (используется connectChatRealtime).
export function isDispatchableChatEventType(type: string): boolean {
  return DISPATCHABLE_TYPES.has(type);
}

/**
 * Один EventSource на `/api/v1/realtime/stream` (тред чата — максимум один открыт
 * одновременно, refcounting как у web's use-realtime.ts не нужен). Диспатч —
 * `message`/`chat:typing`/`chat:read` (см. `DISPATCHABLE_TYPES`); notification/
 * link-request игнорируются. Реконнект — экспоненциальный бэкофф (1с → ×2 → cap 15с).
 */
export function connectChatRealtime(onMessage: (event: ChatRealtimeEvent) => void): () => void {
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let retryMs = RECONNECT_BASE_MS;
  let stopped = false;

  async function connect() {
    const token = await getStored('accessToken');
    if (stopped) return;

    source = new EventSource(`${API_BASE_URL}/api/v1/realtime/stream`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    source.addEventListener('open', () => {
      retryMs = RECONNECT_BASE_MS;
    });

    source.addEventListener('message', (event) => {
      const parsed = parseChatRealtimeEvent(event.data);
      if (parsed && isDispatchableChatEventType(parsed.type)) onMessage(parsed);
    });

    source.addEventListener('error', () => {
      source?.close();
      source = null;
      if (stopped) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, retryMs);
      retryMs = Math.min(retryMs * 2, RECONNECT_MAX_MS);
    });
  }

  void connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    source?.close();
    source = null;
  };
}

/** Коннект на монтировании экрана треда, дисконнект на анмаунт. */
export function useChatRealtime(onMessage: (event: ChatRealtimeEvent) => void): void {
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => connectChatRealtime((event) => handlerRef.current(event)), []);
}
