'use client';

import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { ChatMessage } from '@vire/core';
import { useRealtime } from '@/lib/use-realtime';
import { useIdentity } from '@/lib/e2ee-client';
import { deriveCK, encryptMessage, decryptMessage, fromB64 } from '@/lib/e2ee';
import { toast } from '@/lib/toast';
import { refreshUnread } from '@/lib/chat-unread';
import { markConversationReadLocal } from '@/lib/chat-conversations';
import { mergeMessages, normalizeMessage, type PendingMessage } from '@/lib/chat-messages';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/ui-kit';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';

const KEY_POLL_MS = 8000;
const HISTORY_LIMIT = 50;
const NEAR_BOTTOM_PX = 120;
const LOAD_MORE_SCROLL_PX = 200;

function markRead(conversationId: string) {
  fetch(`/api/v1/chat/${conversationId}/read`, { method: 'POST' })
    .then((res) => {
      if (res.ok) {
        refreshUnread();
        markConversationReadLocal(conversationId);
      }
    })
    .catch(() => {});
}

// Свой useMemo на строку — при добавлении одного нового сообщения пересчитывает только его,
// не гоняет secretbox по всей истории заново (инстанс живёт, пока не изменится key={m.id}).
const DecryptedBubble = memo(function DecryptedBubble({
  body,
  nonce,
  ck,
  createdAt,
  own,
  pending,
}: {
  body: string;
  nonce: string;
  ck: Uint8Array | null;
  createdAt: Date;
  own: boolean;
  pending?: boolean;
}) {
  const t = useTranslations('chat.thread');
  const text = useMemo(() => (ck ? (decryptMessage(body, nonce, ck) ?? t('decryptFailed')) : '🔒'), [body, nonce, ck, t]);
  return <MessageBubble text={text} createdAt={createdAt} own={own} pending={pending} />;
});

export function ChatThread({
  conversationId,
  viewerId,
  otherUserId,
  otherName,
  otherIkPub,
  otherLastReadAt,
  initialMessages,
  canSend,
}: {
  conversationId: string;
  viewerId: string;
  otherUserId: string;
  otherName: string;
  otherIkPub: string | null;
  otherLastReadAt?: Date | string | null;
  initialMessages: ChatMessage[];
  canSend: boolean;
}) {
  const t = useTranslations('chat.thread');
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const [ikPub, setIkPub] = useState(otherIkPub);
  const [readAt, setReadAt] = useState(otherLastReadAt ? new Date(otherLastReadAt) : null);
  const [hasMore, setHasMore] = useState(initialMessages.length >= HISTORY_LIMIT);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const identity = useIdentity(viewerId);
  const refreshingRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const pendingMarkReadRef = useRef(false);

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

  function nearBottom(): boolean {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  function scrollToBottomImmediate() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function scrollToBottom() {
    scrollToBottomImmediate();
    setShowJumpToLatest(false);
  }

  function scrollToBottomSmooth() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }

  function deferOrMarkRead() {
    if (document.visibilityState === 'visible') markRead(conversationId);
    else pendingMarkReadRef.current = true;
  }

  async function refresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const res = await fetch(`/api/v1/chat/${conversationId}/messages`);
      if (!res.ok) return;
      const data: { messages: ChatMessage[] } = await res.json();
      const incoming = data.messages.map(normalizeMessage);
      setMessages((prev) => mergeMessages(prev, incoming));
    } catch {
      // тихо игнорируем — следующий триггер (реконнект/фокус/видимость) повторит попытку
    } finally {
      refreshingRef.current = false;
    }
  }

  async function loadOlder() {
    if (loadingOlderRef.current || !hasMore) return;
    const oldest = messages.find((m) => !m.pending);
    if (!oldest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const before = encodeURIComponent(oldest.createdAt.toISOString());
      const beforeId = encodeURIComponent(oldest.id);
      const res = await fetch(`/api/v1/chat/${conversationId}/messages?before=${before}&beforeId=${beforeId}`);
      if (!res.ok) return;
      const data: { messages: ChatMessage[] } = await res.json();
      const older = data.messages.map(normalizeMessage);
      setHasMore(older.length >= HISTORY_LIMIT);
      if (older.length > 0) {
        setMessages((prev) => mergeMessages(prev, older));
        requestAnimationFrame(() => {
          const el2 = scrollRef.current;
          if (el2) el2.scrollTop += el2.scrollHeight - prevHeight;
        });
      }
    } catch {
      // тихо игнорируем — следующий скролл к верху повторит попытку
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < LOAD_MORE_SCROLL_PX) void loadOlder();
    if (nearBottom()) setShowJumpToLatest(false);
  }

  useLayoutEffect(() => {
    scrollToBottomImmediate();
    deferOrMarkRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (pendingMarkReadRef.current) {
        pendingMarkReadRef.current = false;
        markRead(conversationId);
      }
      void refresh();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    function onFocus() {
      void refresh();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Только подтверждённые: иначе метка «Прочитано/Отправлено» гаснет на время отправки следующего.
  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.senderId === viewerId && !m.pending) return m.id;
    }
    return null;
  }, [messages, viewerId]);

  useRealtime({
    message: (event) => {
      const eventConversationId = event.conversationId as string | undefined;
      if (eventConversationId !== conversationId) return;
      const incoming = normalizeMessage(event.message as ChatMessage);
      const wasNearBottom = nearBottom();
      setMessages((prev) => mergeMessages(prev, [incoming]));
      if (incoming.senderId !== viewerId) deferOrMarkRead();
      if (incoming.senderId === viewerId || wasNearBottom) {
        setShowJumpToLatest(false);
        requestAnimationFrame(scrollToBottomSmooth);
      } else {
        setShowJumpToLatest(true);
      }
    },
    'chat:read': (event) => {
      if (event.conversationId !== conversationId) return;
      const raw = event.readAt as string | undefined;
      if (raw) setReadAt(new Date(raw));
    },
    '@reconnect': () => void refresh(),
  });

  async function handleSend(plaintext: string) {
    if (!ck) return;
    const enc = encryptMessage(plaintext, ck);
    const tempId = crypto.randomUUID();
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
    setShowJumpToLatest(false);
    requestAnimationFrame(scrollToBottomSmooth);

    try {
      const res = await fetch('/api/v1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: otherUserId, ciphertext: enc.ciphertext, nonce: enc.nonce }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { message: ChatMessage } = await res.json();
      const message = normalizeMessage(data.message);
      setMessages((prev) => mergeMessages(prev, [message]));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(t('sendFailed'));
    }
  }

  const blocked: { icon: 'lock' | 'message-square'; title: string; hint: string; action?: React.ReactNode } | null =
    identity.error
      ? { icon: 'lock', title: t('blocked.identityErrorTitle'), hint: t('blocked.identityErrorHint') }
      : identity.ready && identity.needsLink
        ? {
            icon: 'lock',
            title: t('blocked.needsLinkTitle'),
            hint: t('blocked.needsLinkHint'),
            action: (
              <>
                <Link
                  href="/messages"
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-accent/10 md:hidden"
                >
                  {t('blocked.linkDevice')}
                </Link>
                <p className="hidden text-xs text-foreground/35 md:block">{t('blocked.linkHintDesktop')}</p>
              </>
            ),
          }
        : identity.ready && !ikPub
          ? {
              icon: 'message-square',
              title: t('blocked.noKeyTitle', { name: otherName }),
              hint: t('blocked.noKeyHint'),
            }
          : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overflow-x-clip px-3 py-4 sm:px-4">
          {blocked ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Icon name={blocked.icon} size={28} className="text-foreground/25" />
              <EmptyState title={blocked.title} hint={blocked.hint} />
              {blocked.action}
            </div>
          ) : messages.length === 0 && ck ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Icon name="message-square" size={28} className="text-foreground/25" />
              <EmptyState title={t('emptyTitle')} hint={t('emptyHint')} />
            </div>
          ) : (
            <div className="space-y-2">
              {loadingOlder && <p className="py-1 text-center text-xs text-muted-foreground">{t('loading')}</p>}
              {messages.map((m) => (
                <Fragment key={m.id}>
                  <DecryptedBubble body={m.body} nonce={m.nonce} ck={ck} createdAt={m.createdAt} own={m.senderId === viewerId} pending={m.pending} />
                  {m.id === lastOwnMessageId && !m.pending && (
                    <p className="-mt-1 pr-1 text-right font-mono text-[11px] text-muted-foreground">
                      {readAt && new Date(m.createdAt) <= readAt ? t('read') : t('sent')}
                    </p>
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </div>
        {showJumpToLatest && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-lg"
          >
            {t('newMessages')}
          </button>
        )}
      </div>
      {!blocked && <MessageComposer conversationId={conversationId} onSend={handleSend} disabled={!canSend || !ck} />}
    </div>
  );
}
