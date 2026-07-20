import { describe, it, expect, vi } from 'vitest';
import { ChatService, canonicalPair } from '../../services/chat';
import { ValidationError, ForbiddenError, NotFoundError } from '../../errors';
import type { IChatRepository, ChatMessage, ConversationParticipants } from '../../repositories/chat';
import type { IFriendshipRepository, FriendEdge } from '../../repositories/friendship';
import type { IBlockRepository } from '../../repositories/block';
import type { RealtimePublisher } from '../../ports/realtime';
import type { IExternalNotifyQueue } from '../../ports/external-notify';

function makeConv(o?: Partial<ConversationParticipants>): ConversationParticipants {
  return { id: 'conv-1', userLowId: 'u1', userHighId: 'u2', lowLastReadAt: null, highLastReadAt: null, ...o };
}

function makeChatRepo(o?: Partial<IChatRepository>): IChatRepository {
  return {
    findConversation: vi.fn().mockResolvedValue(null),
    upsertConversation: vi.fn().mockResolvedValue('conv-1'),
    getConversation: vi.fn().mockResolvedValue(null),
    insertMessage: vi.fn().mockResolvedValue({ id: 'm1', conversationId: 'conv-1', senderId: 'u1', body: 'ct', nonce: 'nc', createdAt: new Date() }),
    listMessages: vi.fn().mockResolvedValue([]),
    listConversations: vi.fn().mockResolvedValue([]),
    markConversationRead: vi.fn().mockResolvedValue(undefined),
    countUnreadConversations: vi.fn().mockResolvedValue(0),
    ...o,
  };
}
function makeFriendshipRepo(o?: Partial<IFriendshipRepository>): IFriendshipRepository {
  return {
    findEdge: vi.fn().mockResolvedValue({ requesterId: 'u1', addresseeId: 'u2', status: 'ACCEPTED' } as FriendEdge),
    insertRequest: vi.fn(), acceptRequest: vi.fn(), deleteEdge: vi.fn(),
    listFriends: vi.fn(), listIncoming: vi.fn(), userExists: vi.fn(),
    listEdges: vi.fn(), countUnseenIncoming: vi.fn(), markRequestsSeen: vi.fn(),
    ...o,
  };
}
function makeBlockRepo(o?: Partial<IBlockRepository>): IBlockRepository {
  return {
    block: vi.fn(), unblock: vi.fn(),
    existsEitherWay: vi.fn().mockResolvedValue(false),
    existsDirected: vi.fn().mockResolvedValue(false),
    listBlocked: vi.fn(),
    ...o,
  };
}
function makePublisher(): RealtimePublisher {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

function makeService(o?: {
  chat?: Partial<IChatRepository>;
  friendship?: Partial<IFriendshipRepository>;
  block?: Partial<IBlockRepository>;
  externalNotify?: IExternalNotifyQueue;
  publisher?: RealtimePublisher;
  clock?: () => number;
}) {
  return new ChatService(
    makeChatRepo(o?.chat),
    makeFriendshipRepo(o?.friendship),
    makeBlockRepo(o?.block),
    o?.publisher ?? makePublisher(),
    o?.externalNotify,
    o?.clock,
  );
}

describe('canonicalPair', () => {
  it('упорядочивает пару независимо от порядка аргументов', () => {
    expect(canonicalPair('a', 'b')).toEqual(['a', 'b']);
    expect(canonicalPair('b', 'a')).toEqual(['a', 'b']);
  });
});

describe('ChatService.openOrGet', () => {
  it('отклоняет диалог с самим собой', async () => {
    const service = makeService();
    const r = await service.openOrGet('u1', 'u1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
  });

  it('ForbiddenError при блоке', async () => {
    const service = makeService({ block: { existsEitherWay: vi.fn().mockResolvedValue(true) } });
    const r = await service.openOrGet('u1', 'u2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ForbiddenError);
  });

  it('ForbiddenError если не друзья', async () => {
    const service = makeService({ friendship: { findEdge: vi.fn().mockResolvedValue(null) } });
    const r = await service.openOrGet('u1', 'u2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ForbiddenError);
  });

  it('открывает диалог для друзей, канонизируя пару', async () => {
    const upsertConversation = vi.fn().mockResolvedValue('conv-1');
    const service = makeService({ chat: { upsertConversation } });
    const r = await service.openOrGet('z-user', 'a-user');
    expect(r).toEqual({ ok: true, value: { conversationId: 'conv-1' } });
    expect(upsertConversation).toHaveBeenCalledWith('a-user', 'z-user');
  });
});

describe('ChatService.send', () => {
  it('отклоняет пустое сообщение', async () => {
    const service = makeService();
    const r = await service.send('u1', 'u2', { ciphertext: '', nonce: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
  });

  it('отклоняет слишком длинный шифротекст', async () => {
    const service = makeService();
    const r = await service.send('u1', 'u2', { ciphertext: 'A'.repeat(12000), nonce: 'nc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
  });

  it('отказывает писать не-другу (расфрендились, но тред остаётся читаемым)', async () => {
    const service = makeService({ friendship: { findEdge: vi.fn().mockResolvedValue(null) } });
    const r = await service.send('u1', 'u2', { ciphertext: 'ct', nonce: 'nc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ForbiddenError);
  });

  it('отправляет сообщение и публикует событие обеим сторонам', async () => {
    const message: ChatMessage = { id: 'm1', conversationId: 'conv-1', senderId: 'u1', body: 'CT', nonce: 'NC', createdAt: new Date() };
    const insertMessage = vi.fn().mockResolvedValue(message);
    const publish = vi.fn().mockResolvedValue(undefined);
    const service = new ChatService(
      makeChatRepo({ insertMessage, upsertConversation: vi.fn().mockResolvedValue('conv-1') }),
      makeFriendshipRepo(),
      makeBlockRepo(),
      { publish },
    );
    const r = await service.send('u1', 'u2', { ciphertext: 'CT', nonce: 'NC' });
    expect(r).toEqual({ ok: true, value: { conversationId: 'conv-1', message } });
    expect(insertMessage).toHaveBeenCalledWith('conv-1', 'u1', 'CT', 'NC');
    expect(publish).toHaveBeenCalledWith('u2', expect.objectContaining({ type: 'message', conversationId: 'conv-1' }));
    expect(publish).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'message', conversationId: 'conv-1' }));
  });

  it('кладёт senderName в событие обеим сторонам, null если не передан', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ publisher: { publish } });

    await service.send('u1', 'u2', { ciphertext: 'ct', nonce: 'nc' }, 'Аня');
    expect(publish).toHaveBeenCalledWith('u2', expect.objectContaining({ senderName: 'Аня' }));
    expect(publish).toHaveBeenCalledWith('u1', expect.objectContaining({ senderName: 'Аня' }));

    publish.mockClear();
    await service.send('u1', 'u2', { ciphertext: 'ct', nonce: 'nc' });
    expect(publish).toHaveBeenCalledWith('u2', expect.objectContaining({ senderName: null }));
  });

  it('send кладёт внешнее уведомление получателю', async () => {
    const add = vi.fn();
    const service = makeService({ externalNotify: { add } });
    const r = await service.send('from-1', 'to-2', { ciphertext: 'ct', nonce: 'nc' });
    expect(r.ok).toBe(true);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ kind: 'CHAT_MESSAGE', recipientId: 'to-2', actorId: 'from-1' }));
  });
});

describe('ChatService.history', () => {
  it('NotFoundError если диалога нет', async () => {
    const service = makeService();
    const r = await service.history('u1', 'conv-1', null, 30);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(NotFoundError);
  });

  it('ForbiddenError если не участник диалога', async () => {
    const conv = makeConv({ userLowId: 'u2', userHighId: 'u3' });
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv) } });
    const r = await service.history('u1', 'conv-1', null, 30);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ForbiddenError);
  });

  it('возвращает историю для участника', async () => {
    const conv = makeConv();
    const messages: ChatMessage[] = [{ id: 'm1', conversationId: 'conv-1', senderId: 'u2', body: 'ct', nonce: 'nc', createdAt: new Date() }];
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv), listMessages: vi.fn().mockResolvedValue(messages) } });
    const r = await service.history('u1', 'conv-1', null, 30);
    expect(r).toEqual({ ok: true, value: messages });
  });
});

describe('ChatService.markRead', () => {
  it('определяет сторону (low/high) участника и помечает прочитанным', async () => {
    const conv = makeConv({ userLowId: 'u2', userHighId: 'u1' });
    const markConversationRead = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv), markConversationRead } });
    const r = await service.markRead('u1', 'conv-1');
    expect(r.ok).toBe(true);
    expect(markConversationRead).toHaveBeenCalledWith('conv-1', 'high');
  });

  it('ForbiddenError если не участник', async () => {
    const conv = makeConv({ userLowId: 'u2', userHighId: 'u3' });
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv) } });
    const r = await service.markRead('u1', 'conv-1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ForbiddenError);
  });

  it('публикует chat:read второй стороне с readAt по инъектированным часам', async () => {
    const NOW = 1_700_000_000_000;
    const conv = makeConv({ userLowId: 'u1', userHighId: 'u2' });
    const publish = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      chat: { getConversation: vi.fn().mockResolvedValue(conv) },
      publisher: { publish },
      clock: () => NOW,
    });

    const r = await service.markRead('u1', 'conv-1');
    expect(r.ok).toBe(true);
    expect(publish).toHaveBeenCalledWith('u2', { type: 'chat:read', conversationId: 'conv-1', readAt: new Date(NOW).toISOString() });
  });

  it('читает сторона high → публикует low-участнику', async () => {
    const conv = makeConv({ userLowId: 'u1', userHighId: 'u2' });
    const publish = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv) }, publisher: { publish } });

    await service.markRead('u2', 'conv-1');
    expect(publish).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'chat:read' }));
  });
});

describe('ChatService.getConversationMeta', () => {
  it('NotFoundError если диалога нет', async () => {
    const service = makeService();
    const r = await service.getConversationMeta('u1', 'conv-1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(NotFoundError);
  });

  it('ForbiddenError если не участник диалога', async () => {
    const conv = makeConv({ userLowId: 'u2', userHighId: 'u3' });
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv) } });
    const r = await service.getConversationMeta('u1', 'conv-1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ForbiddenError);
  });

  it('возвращает id собеседника и его otherLastReadAt для участника', async () => {
    const readAt = new Date('2026-07-20T12:00:00Z');
    const conv = makeConv({ userLowId: 'u1', userHighId: 'u2', highLastReadAt: readAt });
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv) } });
    const r = await service.getConversationMeta('u1', 'conv-1');
    expect(r).toEqual({ ok: true, value: { otherUserId: 'u2', otherLastReadAt: readAt } });
  });

  it('otherLastReadAt берётся с противоположной стороны, когда читает high', async () => {
    const readAt = new Date('2026-07-20T12:00:00Z');
    const conv = makeConv({ userLowId: 'u1', userHighId: 'u2', lowLastReadAt: readAt });
    const service = makeService({ chat: { getConversation: vi.fn().mockResolvedValue(conv) } });
    const r = await service.getConversationMeta('u2', 'conv-1');
    expect(r).toEqual({ ok: true, value: { otherUserId: 'u1', otherLastReadAt: readAt } });
  });
});

describe('ChatService.listConversations / countUnread', () => {
  it('делегируют в репозиторий', async () => {
    const listConversations = vi.fn().mockResolvedValue([]);
    const countUnreadConversations = vi.fn().mockResolvedValue(2);
    const service = makeService({ chat: { listConversations, countUnreadConversations } });
    await service.listConversations('u1');
    expect(listConversations).toHaveBeenCalledWith('u1');
    expect(await service.countUnread('u1')).toBe(2);
  });
});
