import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { chatService } from '@/lib/chat';
import { ValidationError, type ChatMessage } from '@vire/core';
import { sendChatMessageSchema, type SendChatMessageResponse } from '@vire/api-contracts';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

function toResponse(value: { conversationId: string; message: ChatMessage }): SendChatMessageResponse {
  return { conversationId: value.conversationId, message: { ...value.message, createdAt: value.message.createdAt.toISOString() } };
}

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`chat-send:${caller.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const json = await req.json().catch(() => null);
  const parsed = sendChatMessageSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await chatService().send(
    caller.id,
    parsed.data.toUserId,
    { ciphertext: parsed.data.ciphertext, nonce: parsed.data.nonce },
    caller.name,
  );
  if (!result.ok) {
    const status = result.error instanceof ValidationError ? 422 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json(toResponse(result.value));
}
