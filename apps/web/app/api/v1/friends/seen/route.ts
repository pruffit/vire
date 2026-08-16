import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { friendshipService } from '@/lib/friends';

export async function POST() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await friendshipService().markSeen(caller.id);
  return NextResponse.json({ ok: true });
}
