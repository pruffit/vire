export type ChatMessage = { id: string; conversationId: string; senderId: string; body: string; createdAt: Date };
export type ConversationParticipants = { id: string; userLowId: string; userHighId: string };
export type ConversationSummary = {
  id: string;
  otherUserId: string;
  otherUserName: string | null;
  otherUserImage: string | null;
  lastMessageAt: Date | null;
  lastMessageBody: string | null;
  lastMessageSenderId: string | null;
  unread: boolean;
};

export interface IChatRepository {
  findConversation(low: string, high: string): Promise<ConversationParticipants | null>;
  upsertConversation(low: string, high: string): Promise<string>;
  getConversation(conversationId: string): Promise<ConversationParticipants | null>;
  insertMessage(conversationId: string, senderId: string, body: string): Promise<ChatMessage>;
  listMessages(conversationId: string, before: Date | null, limit: number): Promise<ChatMessage[]>;
  listConversations(userId: string): Promise<ConversationSummary[]>;
  markConversationRead(conversationId: string, side: 'low' | 'high'): Promise<void>;
  countUnreadConversations(userId: string): Promise<number>;
}
