import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService } from '@vire/core';
import { type PersonalBlockResponse } from '@vire/api-contracts';

export async function GET(_req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const result = await service.personalBlock({ userId: caller.id });
  return NextResponse.json(result satisfies PersonalBlockResponse);
}
