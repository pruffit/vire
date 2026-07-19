import { err, ok, ValidationError, ForbiddenError, NotFoundError, type Result } from '../errors';
import type { IChatRepository, ChatMessage, ConversationSummary } from '../repositories/chat';
import type { IFriendshipRepository } from '../repositories/friendship';
import type { IBlockRepository } from '../repositories/block';
import type { RealtimePublisher } from '../ports/realtime';
import type { IExternalNotifyQueue } from '../ports/external-notify';

// Плейнтекст-длину (1–4000) валидирует клиент до шифрования; сервер слеп и проверяет
// только байтовый размер шифротекста (4000 UTF-8 симв. + secretbox-оверхед с запасом).
const CIPHERTEXT_MAX_BYTES = 8192;

function b64Bytes(s: string): number {
  const len = s.length;
  if (len === 0) return 0;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return (len * 3) / 4 - pad;
}

export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export class ChatService {
  constructor(
    private readonly repo: IChatRepository,
    private readonly friendshipRepo: IFriendshipRepository,
    private readonly blockRepo: IBlockRepository,
    private readonly publisher: RealtimePublisher,
    private readonly externalNotify?: IExternalNotifyQueue,
  ) {}

  async openOrGet(a: string, b: string): Promise<Result<{ conversationId: string }, ValidationError | ForbiddenError>> {
    if (a === b) return err(new ValidationError('Нельзя написать самому себе'));
    const guard = await this.guardCanChat(a, b);
    if (!guard.ok) return guard;

    const [low, high] = canonicalPair(a, b);
    const conversationId = await this.repo.upsertConversation(low, high);
    return ok({ conversationId });
  }

  async send(
    fromUserId: string,
    toUserId: string,
    payload: { ciphertext: unknown; nonce: unknown },
  ): Promise<Result<{ conversationId: string; message: ChatMessage }, ValidationError | ForbiddenError>> {
    if (fromUserId === toUserId) return err(new ValidationError('Нельзя написать самому себе'));
    const guard = await this.guardCanChat(fromUserId, toUserId);
    if (!guard.ok) return guard;

    const ciphertext = typeof payload.ciphertext === 'string' ? payload.ciphertext : '';
    const nonce = typeof payload.nonce === 'string' ? payload.nonce : '';
    if (!ciphertext || !nonce) return err(new ValidationError('Пустое сообщение'));
    if (b64Bytes(ciphertext) > CIPHERTEXT_MAX_BYTES) return err(new ValidationError('Сообщение слишком длинное'));

    const [low, high] = canonicalPair(fromUserId, toUserId);
    const conversationId = await this.repo.upsertConversation(low, high);
    const message = await this.repo.insertMessage(conversationId, fromUserId, ciphertext, nonce);

    await this.publisher.publish(toUserId, { type: 'message', conversationId, message });
    // синхронизирует другие открытые вкладки отправителя
    await this.publisher.publish(fromUserId, { type: 'message', conversationId, message });

    try {
      await this.externalNotify?.add({ kind: 'CHAT_MESSAGE', recipientId: toUserId, actorId: fromUserId, conversationId });
    } catch {
      // best-effort: провал очереди не должен валить отправку сообщения
    }

    return ok({ conversationId, message });
  }

  async history(
    userId: string,
    conversationId: string,
    before: Date | null,
    limit: number,
  ): Promise<Result<ChatMessage[], NotFoundError | ForbiddenError>> {
    const membership = await this.requireParticipant(userId, conversationId);
    if (!membership.ok) return membership;
    return ok(await this.repo.listMessages(conversationId, before, limit));
  }

  async markRead(userId: string, conversationId: string): Promise<Result<void, NotFoundError | ForbiddenError>> {
    const membership = await this.requireParticipant(userId, conversationId);
    if (!membership.ok) return membership;
    await this.repo.markConversationRead(conversationId, membership.value.userLowId === userId ? 'low' : 'high');
    return ok(undefined);
  }

  listConversations(userId: string): Promise<ConversationSummary[]> { return this.repo.listConversations(userId); }
  countUnread(userId: string): Promise<number> { return this.repo.countUnreadConversations(userId); }

  async getConversationMeta(
    userId: string,
    conversationId: string,
  ): Promise<Result<{ otherUserId: string }, NotFoundError | ForbiddenError>> {
    const membership = await this.requireParticipant(userId, conversationId);
    if (!membership.ok) return membership;
    const otherUserId = membership.value.userLowId === userId ? membership.value.userHighId : membership.value.userLowId;
    return ok({ otherUserId });
  }

  private async requireParticipant(
    userId: string,
    conversationId: string,
  ): Promise<Result<{ userLowId: string; userHighId: string }, NotFoundError | ForbiddenError>> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) return err(new NotFoundError('Conversation', conversationId));
    if (conv.userLowId !== userId && conv.userHighId !== userId) {
      return err(new ForbiddenError('Not a participant'));
    }
    return ok(conv);
  }

  // Не хранит состояние: гейт «друзья+блок» читается заново на каждый вызов —
  // расфрендились/заблокировали → следующая отправка сразу откажет.
  private async guardCanChat(a: string, b: string): Promise<Result<void, ForbiddenError>> {
    if (await this.blockRepo.existsEitherWay(a, b)) {
      return err(new ForbiddenError('Написать нельзя: пользователь недоступен'));
    }
    const edge = await this.friendshipRepo.findEdge(a, b);
    if (!edge || edge.status !== 'ACCEPTED') return err(new ForbiddenError('Написать можно только другу'));
    return ok(undefined);
  }
}
