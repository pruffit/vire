import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import type { ChatUnreadCountResponse } from '@vire/api-contracts';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const count = await chatService().countUnread(session.user.id);
  return NextResponse.json({ count } satisfies ChatUnreadCountResponse);
}
