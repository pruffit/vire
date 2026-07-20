import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friends = await friendshipService().listFriends(session.user.id);
  return NextResponse.json({ friends });
}
