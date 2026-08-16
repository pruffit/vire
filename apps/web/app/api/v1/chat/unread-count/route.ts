import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { chatService } from '@/lib/chat';
import type { ChatUnreadCountResponse } from '@vire/api-contracts';

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const count = await chatService().countUnread(caller.id);
  return NextResponse.json({ count } satisfies ChatUnreadCountResponse);
}
