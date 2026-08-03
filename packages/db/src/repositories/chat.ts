import type { IChatRepository, ChatMessage, ConversationParticipants, ConversationSummary } from '@vire/core';
import {
  findConversation, upsertConversation, getConversation, insertMessage, listMessages,
  listConversations, markConversationRead, countUnreadConversations,
} from '../queries/chat';

export class DrizzleChatRepository implements IChatRepository {
  findConversation(low: string, high: string): Promise<ConversationParticipants | null> { return findConversation(low, high); }
  upsertConversation(low: string, high: string): Promise<string> { return upsertConversation(low, high); }
  getConversation(conversationId: string): Promise<ConversationParticipants | null> { return getConversation(conversationId); }
  insertMessage(conversationId: string, senderId: string, ciphertext: string, nonce: string): Promise<ChatMessage> {
    return insertMessage(conversationId, senderId, ciphertext, nonce);
  }
  listMessages(conversationId: string, before: { createdAt: Date; id: string } | null, limit: number): Promise<ChatMessage[]> {
    return listMessages(conversationId, before, limit);
  }
  listConversations(userId: string): Promise<ConversationSummary[]> { return listConversations(userId); }
  markConversationRead(conversationId: string, side: 'low' | 'high'): Promise<void> {
    return markConversationRead(conversationId, side);
  }
  countUnreadConversations(userId: string): Promise<number> { return countUnreadConversations(userId); }
}
