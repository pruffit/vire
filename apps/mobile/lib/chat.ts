import {
  openChatResponseSchema,
  chatMessagesResponseSchema,
  sendChatMessageResponseSchema,
  getKeyResponseSchema,
  chatConversationsResponseSchema,
  type OpenChatResponse,
  type ChatMessagesResponse,
  type SendChatMessageResponse,
  type GetKeyResponse,
  type ChatConversationsResponse,
} from '@vire/api-contracts';
import type { ApiResult } from '@vire/api-client';
import { apiRequest } from './api-client';

// Сегменты пути экранируем — тот же принцип, что apps/mobile/lib/friends.ts.
const seg = encodeURIComponent;

export function openConversation(userId: string): Promise<ApiResult<OpenChatResponse>> {
  return apiRequest('/api/v1/chat/open', {
    method: 'POST',
    schema: openChatResponseSchema,
    body: { userId },
  });
}

export function fetchMessages(
  conversationId: string,
  cursor?: { createdAt: string; id: string },
): Promise<ApiResult<ChatMessagesResponse>> {
  const query = cursor ? `?before=${seg(cursor.createdAt)}&beforeId=${seg(cursor.id)}` : '';
  return apiRequest(`/api/v1/chat/${seg(conversationId)}/messages${query}`, {
    schema: chatMessagesResponseSchema,
  });
}

export function sendMessage(
  toUserId: string,
  ciphertext: string,
  nonce: string,
): Promise<ApiResult<SendChatMessageResponse>> {
  return apiRequest('/api/v1/chat/messages', {
    method: 'POST',
    schema: sendChatMessageResponseSchema,
    body: { toUserId, ciphertext, nonce },
  });
}

export function fetchPeerKey(userId: string): Promise<ApiResult<GetKeyResponse>> {
  return apiRequest(`/api/v1/keys?userId=${seg(userId)}`, { schema: getKeyResponseSchema });
}

export function fetchConversations(): Promise<ApiResult<ChatConversationsResponse>> {
  return apiRequest('/api/v1/chat/conversations', { schema: chatConversationsResponseSchema });
}
