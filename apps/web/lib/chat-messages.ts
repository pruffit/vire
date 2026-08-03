import type { ChatMessage } from '@vire/core';

export type PendingMessage = ChatMessage & { pending?: boolean };

export function normalizeMessage(raw: ChatMessage): ChatMessage {
  return { ...raw, createdAt: new Date(raw.createdAt) };
}

// pending снимается и по совпадению шифротекста, не только по id: SSE своего же
// сообщения может обогнать ответ POST, и тогда id ещё неизвестен.
export function mergeMessages(prev: PendingMessage[], incoming: ChatMessage[]): PendingMessage[] {
  const incomingBodies = new Set(incoming.map((m) => m.body));
  const byId = new Map<string, PendingMessage>();

  for (const m of prev) {
    if (m.pending && incomingBodies.has(m.body)) continue;
    byId.set(m.id, m);
  }
  for (const m of incoming) {
    byId.set(m.id, m);
  }

  const merged = Array.from(byId.values());
  const settled = merged
    .filter((m) => !m.pending)
    .sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime();
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const pending = merged.filter((m) => m.pending);
  return [...settled, ...pending];
}
