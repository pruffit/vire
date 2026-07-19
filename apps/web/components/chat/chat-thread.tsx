'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@vire/core';
import { useRealtime } from '@/lib/use-realtime';
import { useIdentity } from '@/lib/e2ee-client';
import { deriveCK, encryptMessage, decryptMessage, safetyNumber, fromB64 } from '@/lib/e2ee';
import { toast } from '@/lib/toast';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';

type PendingMessage = ChatMessage & { pending?: boolean };

function normalizeMessage(raw: ChatMessage): ChatMessage {
  return { ...raw, createdAt: new Date(raw.createdAt) };
}

function markRead(conversationId: string) {
  fetch(`/api/v1/chat/${conversationId}/read`, { method: 'POST' }).catch(() => {});
}

export function ChatThread({
  conversationId,
  viewerId,
  otherUserId,
  otherIkPub,
  initialMessages,
  canSend,
}: {
  conversationId: string;
  viewerId: string;
  otherUserId: string;
  otherIkPub: string | null;
  initialMessages: ChatMessage[];
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const identity = useIdentity(viewerId);

  const ck = useMemo(() => {
    if (!identity.priv || !identity.pub || !otherIkPub) return null;
    return deriveCK(identity.priv, fromB64(otherIkPub), identity.pub);
  }, [identity.priv, identity.pub, otherIkPub]);

  const safety = useMemo(() => {
    if (!identity.pub || !otherIkPub) return null;
    return safetyNumber(identity.pub, fromB64(otherIkPub));
  }, [identity.pub, otherIkPub]);

  // Расшифровываем на изменение сообщений/ключа, а не на каждый рендер.
  const decrypted = useMemo(() => {
    const map = new Map<string, string>();
    if (ck) for (const m of messages) map.set(m.id, decryptMessage(m.body, m.nonce, ck) ?? '🔒 не удалось расшифровать');
    return map;
  }, [messages, ck]);

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
    markRead(conversationId);
  }, [conversationId]);

  useRealtime({
    message: (event) => {
      const eventConversationId = event.conversationId as string | undefined;
      if (eventConversationId !== conversationId) return;
      const incoming = normalizeMessage(event.message as ChatMessage);
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      if (incoming.senderId !== viewerId) markRead(conversationId);
      requestAnimationFrame(() => scrollToBottom('smooth'));
    },
  });

  async function handleSend(plaintext: string) {
    if (!ck) return;
    const enc = encryptMessage(plaintext, ck);
    const tempId = `pending-${Date.now()}`;
    const optimistic: PendingMessage = {
      id: tempId,
      conversationId,
      senderId: viewerId,
      body: enc.ciphertext,
      nonce: enc.nonce,
      createdAt: new Date(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom('smooth'));

    try {
      const res = await fetch('/api/v1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: otherUserId, ciphertext: enc.ciphertext, nonce: enc.nonce }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { message: ChatMessage } = await res.json();
      const message = normalizeMessage(data.message);
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== tempId);
        return withoutPending.some((m) => m.id === message.id) ? withoutPending : [...withoutPending, message];
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error('Не удалось отправить сообщение');
    }
  }

  const notReady = identity.error
    ? 'Не удалось загрузить шифрование. Обновите страницу.'
    : identity.ready && identity.needsLink
      ? 'Переписка зашифрована. Подтвердите это устройство на другом своём устройстве, чтобы читать и писать.'
      : identity.ready && !otherIkPub
        ? 'У собеседника ещё не настроено шифрование.'
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
        {safety && (
          <details className="mb-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">🔒 Сквозное шифрование — код безопасности</summary>
            <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{safety}</p>
            <p className="mt-1">Совпадает у обоих — переписку никто не читает.</p>
          </details>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            text={ck ? decrypted.get(m.id) ?? '🔒' : '🔒'}
            createdAt={m.createdAt}
            own={m.senderId === viewerId}
            pending={m.pending}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      {notReady ? (
        <div className="shrink-0 border-t border-border/40 bg-background px-4 py-3 text-center text-sm text-muted-foreground">
          {notReady}
        </div>
      ) : (
        <MessageComposer onSend={handleSend} disabled={!canSend || !ck} />
      )}
    </div>
  );
}
