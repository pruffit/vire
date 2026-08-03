// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationSummary } from '@vire/core';
import {
  useChatConversationsStore,
  applyIncomingMessage,
  markConversationReadLocal,
  refreshConversations,
} from './chat-conversations';

function conv(id: string, overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id,
    otherUserId: `other-${id}`,
    otherUserName: 'Аня',
    otherUserImage: null,
    otherIkPub: 'ik==',
    lastMessageAt: new Date('2026-01-01T00:00:00Z'),
    lastMessageBody: 'ct==',
    lastMessageNonce: 'n==',
    lastMessageSenderId: 'other',
    unread: false,
    ...overrides,
  };
}

const message = { body: 'new-ct==', nonce: 'new-n==', createdAt: '2026-02-01T10:00:00.000Z' };

beforeEach(() => {
  useChatConversationsStore.setState({ conversations: [], initialized: false, ownerId: null });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ conversations: [] }) } as Response)));
});

describe('seed', () => {
  it('сидирует один раз для того же владельца', () => {
    const { seed } = useChatConversationsStore.getState();
    seed([conv('c1')], 'u1');
    seed([conv('c2')], 'u1');
    expect(useChatConversationsStore.getState().conversations.map((c) => c.id)).toEqual(['c1']);
  });

  it('другой владелец в той же вкладке → пересид, чужой список не остаётся', () => {
    const { seed } = useChatConversationsStore.getState();
    seed([conv('c1')], 'u1');
    seed([conv('c2')], 'u2');
    const state = useChatConversationsStore.getState();
    expect(state.conversations.map((c) => c.id)).toEqual(['c2']);
    expect(state.ownerId).toBe('u2');
  });
});

describe('applyIncomingMessage', () => {
  it('чужое сообщение поднимает диалог наверх и метит непрочитанным', () => {
    useChatConversationsStore.getState().seed([conv('c1'), conv('c2')], 'u1');
    applyIncomingMessage({ conversationId: 'c2', message, senderId: 'other-c2', viewerId: 'u1', activeId: null });

    const [first, second] = useChatConversationsStore.getState().conversations;
    expect(first!.id).toBe('c2');
    expect(second!.id).toBe('c1');
    expect(first!.unread).toBe(true);
    expect(first!.lastMessageBody).toBe('new-ct==');
    expect(first!.lastMessageAt).toBeInstanceOf(Date);
  });

  it('своё сообщение непрочитанным не метит', () => {
    useChatConversationsStore.getState().seed([conv('c1')], 'u1');
    applyIncomingMessage({ conversationId: 'c1', message, senderId: 'u1', viewerId: 'u1', activeId: null });
    expect(useChatConversationsStore.getState().conversations[0]!.unread).toBe(false);
  });

  it('открытый и видимый диалог непрочитанным не метит', () => {
    useChatConversationsStore.getState().seed([conv('c1')], 'u1');
    applyIncomingMessage({ conversationId: 'c1', message, senderId: 'other-c1', viewerId: 'u1', activeId: 'c1' });
    expect(useChatConversationsStore.getState().conversations[0]!.unread).toBe(false);
  });

  it('открытый, но невидимый диалог остаётся непрочитанным', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    useChatConversationsStore.getState().seed([conv('c1')], 'u1');
    applyIncomingMessage({ conversationId: 'c1', message, senderId: 'other-c1', viewerId: 'u1', activeId: 'c1' });
    expect(useChatConversationsStore.getState().conversations[0]!.unread).toBe(true);
  });

  it('неизвестный диалог → рефетч списка', () => {
    useChatConversationsStore.getState().seed([conv('c1')], 'u1');
    applyIncomingMessage({ conversationId: 'unknown', message, senderId: 'x', viewerId: 'u1', activeId: null });
    expect(fetch).toHaveBeenCalledWith('/api/v1/chat/conversations');
  });

  it('диалог без ключа собеседника → рефетч, чтобы превью расшифровалось', () => {
    useChatConversationsStore.getState().seed([conv('c1', { otherIkPub: null })], 'u1');
    applyIncomingMessage({ conversationId: 'c1', message, senderId: 'other-c1', viewerId: 'u1', activeId: null });
    expect(fetch).toHaveBeenCalledWith('/api/v1/chat/conversations');
  });
});

describe('markConversationReadLocal', () => {
  it('снимает непрочитанность только с указанного диалога', () => {
    useChatConversationsStore.getState().seed([conv('c1', { unread: true }), conv('c2', { unread: true })], 'u1');
    markConversationReadLocal('c1');
    const [c1, c2] = useChatConversationsStore.getState().conversations;
    expect(c1!.unread).toBe(false);
    expect(c2!.unread).toBe(true);
  });
});

describe('refreshConversations', () => {
  it('приводит lastMessageAt из JSON к Date', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ conversations: [{ ...conv('c1'), lastMessageAt: '2026-03-01T12:00:00.000Z' }] }),
    } as Response)));

    refreshConversations();
    await vi.waitFor(() => expect(useChatConversationsStore.getState().conversations).toHaveLength(1));
    expect(useChatConversationsStore.getState().conversations[0]!.lastMessageAt).toBeInstanceOf(Date);
  });
});
