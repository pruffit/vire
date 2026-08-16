import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { friendshipService } from '@/lib/friends';
import type { FriendsResponse } from '@vire/api-contracts';

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friends = await friendshipService().listFriends(caller.id);
  const body: FriendsResponse = {
    friends: friends.map((f) => ({ ...f, since: f.since.toISOString() })),
  };
  return NextResponse.json(body);
}
