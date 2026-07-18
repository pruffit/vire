'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@vire/core';
import { useRealtime } from '@/lib/use-realtime';
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
  initialMessages,
  canSend,
}: {
  conversationId: string;
  viewerId: string;
  otherUserId: string;
  initialMessages: ChatMessage[];
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании треда
  useEffect(() => {
    scrollToBottom();
    markRead(conversationId);
  }, []);

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

  async function handleSend(body: string) {
    const tempId = `pending-${Date.now()}`;
    const optimistic: PendingMessage = {
      id: tempId,
      conversationId,
      senderId: viewerId,
      body,
      createdAt: new Date(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom('smooth'));

    try {
      const res = await fetch('/api/v1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: otherUserId, body }),
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} own={m.senderId === viewerId} pending={m.pending} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageComposer onSend={handleSend} disabled={!canSend} />
    </div>
  );
}
