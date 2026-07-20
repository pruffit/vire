'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { ChatMessage } from '@vire/core';
import { useRealtime } from '@/lib/use-realtime';
import { useIdentity } from '@/lib/e2ee-client';
import { deriveCK, encryptMessage, decryptMessage, safetyNumber, fromB64 } from '@/lib/e2ee';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/ui-kit';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';

const KEY_POLL_MS = 8000;

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
  otherName,
  otherIkPub,
  initialMessages,
  canSend,
}: {
  conversationId: string;
  viewerId: string;
  otherUserId: string;
  otherName: string;
  otherIkPub: string | null;
  initialMessages: ChatMessage[];
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const [ikPub, setIkPub] = useState(otherIkPub);
  const bottomRef = useRef<HTMLDivElement>(null);
  const identity = useIdentity(viewerId);

  useEffect(() => {
    if (ikPub || !identity.ready) return;
    const check = async () => {
      const res = await fetch(`/api/v1/keys?userId=${otherUserId}`).catch(() => null);
      if (!res?.ok) return;
      const { ikPub: fetched } = (await res.json()) as { ikPub: string | null };
      if (fetched) setIkPub(fetched);
    };
    void check();
    const interval = setInterval(check, KEY_POLL_MS);
    return () => clearInterval(interval);
  }, [ikPub, identity.ready, otherUserId]);

  const ck = useMemo(() => {
    if (!identity.priv || !identity.pub || !ikPub) return null;
    return deriveCK(identity.priv, fromB64(ikPub), identity.pub);
  }, [identity.priv, identity.pub, ikPub]);

  const safety = useMemo(() => {
    if (!identity.pub || !ikPub) return null;
    return safetyNumber(identity.pub, fromB64(ikPub));
  }, [identity.pub, ikPub]);

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

  const blocked: { icon: 'lock' | 'message-square'; title: string; hint: string; action?: React.ReactNode } | null =
    identity.error
      ? { icon: 'lock', title: 'Не удалось загрузить шифрование', hint: 'Обновите страницу и попробуйте снова.' }
      : identity.ready && identity.needsLink
        ? {
            icon: 'lock',
            title: 'Подтвердите это устройство',
            hint: 'Переписка зашифрована. Подтвердите устройство на другом своём, где уже открыт Vire, чтобы читать и писать.',
            action: (
              <>
                <Link
                  href="/messages"
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-accent/10 md:hidden"
                >
                  Привязать устройство
                </Link>
                <p className="hidden text-xs text-foreground/35 md:block">Привязка — на панели слева.</p>
              </>
            ),
          }
        : identity.ready && !ikPub
          ? {
              icon: 'message-square',
              title: `${otherName} ещё не открывал(а) Vire`,
              hint: 'Переписка станет доступна, как только собеседник зайдёт в приложение.',
            }
          : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {safety && (
          <details className="mb-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">🔒 Сквозное шифрование — код безопасности</summary>
            <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{safety}</p>
            <p className="mt-1">Совпадает у обоих — переписку никто не читает.</p>
          </details>
        )}
        {blocked ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Icon name={blocked.icon} size={28} className="text-foreground/25" />
            <EmptyState title={blocked.title} hint={blocked.hint} />
            {blocked.action}
          </div>
        ) : messages.length === 0 && ck ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Icon name="message-square" size={28} className="text-foreground/25" />
            <EmptyState title="Напишите первое сообщение" hint="Переписка защищена сквозным шифрованием" />
          </div>
        ) : (
          <div className="space-y-2">
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
        )}
      </div>
      {!blocked && <MessageComposer onSend={handleSend} disabled={!canSend || !ck} />}
    </div>
  );
}
