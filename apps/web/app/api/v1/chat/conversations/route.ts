import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversations = await chatService().listConversations(session.user.id);
  return NextResponse.json({ conversations });
}
