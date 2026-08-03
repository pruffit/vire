import { create } from 'zustand';
import { useEffect } from 'react';
import type { ConversationSummary } from '@vire/core';

interface IncomingMessage {
  body: string;
  nonce: string;
  createdAt: Date | string;
}

interface ApplyIncomingMessageArgs {
  conversationId: string;
  message: IncomingMessage;
  senderId: string;
  viewerId: string;
  activeId: string | null;
}

interface ChatConversationsState {
  conversations: ConversationSummary[];
  initialized: boolean;
  ownerId: string | null;
  seed: (conversations: ConversationSummary[], ownerId: string) => void;
  set: (conversations: ConversationSummary[]) => void;
}

export const useChatConversationsStore = create<ChatConversationsState>((set, get) => ({
  conversations: [],
  initialized: false,
  ownerId: null,
  seed: (conversations, ownerId) => {
    if (get().initialized && get().ownerId === ownerId) return;
    set({ conversations, initialized: true, ownerId });
  },
  set: (conversations) => set({ conversations, initialized: true }),
}));

/** Живой список диалогов — молча игнорит сетевые ошибки, вызывается фоново. */
export function refreshConversations(): void {
  fetch('/api/v1/chat/conversations')
    .then((r) => (r.ok ? (r.json() as Promise<{ conversations: ConversationSummary[] }>) : null))
    .then((d) => {
      if (!d) return;
      // JSON отдаёт даты строками, а тип обещает Date — иначе мина для любого .getTime() выше по коду.
      const normalized = d.conversations.map((c) => ({ ...c, lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : null }));
      useChatConversationsStore.getState().set(normalized);
    })
    .catch(() => {});
}

/**
 * SSR-проп сидирует стор один раз за монтаж лейаута; дальше источник истины — live список.
 * Другой `viewerId` (смена юзера в той же вкладке без hard-reload) форсирует пересид.
 */
export function useConversations(initial: ConversationSummary[], viewerId: string): ConversationSummary[] {
  const conversations = useChatConversationsStore((s) => s.conversations);
  const initialized = useChatConversationsStore((s) => s.initialized);
  const ownerId = useChatConversationsStore((s) => s.ownerId);

  useEffect(() => {
    useChatConversationsStore.getState().seed(initial, viewerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId]);

  return initialized && ownerId === viewerId ? conversations : initial;
}

// Неизвестный диалог (первое сообщение) — рефетч: локально нет имени/аватара/ключа собеседника.
export function applyIncomingMessage({ conversationId, message, senderId, viewerId, activeId }: ApplyIncomingMessageArgs): void {
  const { conversations } = useChatConversationsStore.getState();
  const idx = conversations.findIndex((c) => c.id === conversationId);
  if (idx === -1) {
    refreshConversations();
    return;
  }

  const current = conversations[idx]!;
  // Ключ собеседника появился только что — превью иначе навсегда осталось бы «зашифровано».
  if (!current.otherIkPub) refreshConversations();

  const isOwn = senderId === viewerId;
  // Открытый, но невидимый диалог прочитанным не считается: markRead в треде тоже отложен.
  const readHere = conversationId === activeId && document.visibilityState === 'visible';
  const updated: ConversationSummary = {
    ...current,
    lastMessageAt: new Date(message.createdAt),
    lastMessageBody: message.body,
    lastMessageNonce: message.nonce,
    lastMessageSenderId: senderId,
    unread: !isOwn && !readHere,
  };
  const rest = conversations.filter((_, i) => i !== idx);
  useChatConversationsStore.getState().set([updated, ...rest]);
}

export function markConversationReadLocal(conversationId: string): void {
  const { conversations } = useChatConversationsStore.getState();
  useChatConversationsStore.getState().set(conversations.map((c) => (c.id === conversationId ? { ...c, unread: false } : c)));
}
