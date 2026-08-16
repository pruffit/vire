import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { friendshipService } from '@/lib/friends';

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friends = await friendshipService().listFriends(caller.id);
  return NextResponse.json({ friends });
}
