import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await friendshipService().markSeen(session.user.id);
  return NextResponse.json({ ok: true });
}
