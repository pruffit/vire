import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import type { ConversationSummary } from '@vire/core';
import type { ChatConversationsResponse } from '@vire/api-contracts';

function toResponse(conversations: ConversationSummary[]): ChatConversationsResponse {
  return { conversations: conversations.map((c) => ({ ...c, lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null })) };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversations = await chatService().listConversations(session.user.id);
  return NextResponse.json(toResponse(conversations));
}
