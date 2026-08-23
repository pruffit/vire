import { z } from 'zod';
import { uuidSchema } from './common';

export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  body: z.string(),
  nonce: z.string(),
  createdAt: z.string(),
});
export type ChatMessageDTO = z.infer<typeof chatMessageSchema>;

export const chatConversationSchema = z.object({
  id: z.string(),
  otherUserId: z.string(),
  otherUserName: z.string().nullable(),
  otherUserImage: z.string().nullable(),
  otherIkPub: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  lastMessageBody: z.string().nullable(),
  lastMessageNonce: z.string().nullable(),
  lastMessageSenderId: z.string().nullable(),
  unread: z.boolean(),
});
export type ChatConversationDTO = z.infer<typeof chatConversationSchema>;

export const chatConversationsResponseSchema = z.object({ conversations: z.array(chatConversationSchema) });
export type ChatConversationsResponse = z.infer<typeof chatConversationsResponseSchema>;

export const chatMessagesResponseSchema = z.object({ messages: z.array(chatMessageSchema) });
export type ChatMessagesResponse = z.infer<typeof chatMessagesResponseSchema>;

// Повторяет ручную проверку из route: before/beforeId — пара или ничего, дата и uuid валидны.
export const chatHistoryCursorSchema = z
  .object({ before: z.string().nullable(), beforeId: z.string().nullable() })
  .transform((v, ctx) => {
    if (!v.before && !v.beforeId) return null;
    const date = v.before ? new Date(v.before) : null;
    const id = v.beforeId ? z.string().uuid().safeParse(v.beforeId) : null;
    if (!date || Number.isNaN(date.getTime()) || !id?.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid before' });
      return z.NEVER;
    }
    return { createdAt: date, id: id.data };
  });
export type ChatHistoryCursor = z.infer<typeof chatHistoryCursorSchema>;

export const sendChatMessageSchema = z.object({
  toUserId: uuidSchema,
  ciphertext: z.string().min(1).max(12000),
  nonce: z.string().min(1).max(64),
});
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

export const sendChatMessageResponseSchema = z.object({
  conversationId: z.string(),
  message: chatMessageSchema,
});
export type SendChatMessageResponse = z.infer<typeof sendChatMessageResponseSchema>;

export const openChatSchema = z.object({ userId: uuidSchema });
export type OpenChatInput = z.infer<typeof openChatSchema>;

export const openChatResponseSchema = z.object({ conversationId: z.string() });
export type OpenChatResponse = z.infer<typeof openChatResponseSchema>;

export const chatUnreadCountResponseSchema = z.object({ count: z.number() });
export type ChatUnreadCountResponse = z.infer<typeof chatUnreadCountResponseSchema>;

export const getKeyResponseSchema = z.object({ ikPub: z.string().nullable() });
export type GetKeyResponse = z.infer<typeof getKeyResponseSchema>;
