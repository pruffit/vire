import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService, type FriendActivityItem } from '@vire/core';
import { type FriendsActivityResponse } from '@vire/api-contracts';

function toResponse(items: FriendActivityItem[]): FriendsActivityResponse {
  return { items: items.map((item) => ({ ...item, at: item.at.toISOString() })) };
}

export async function GET(_req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const items = await service.friendsActivityBlock({ userId: caller.id });
  return NextResponse.json(toResponse(items));
}
