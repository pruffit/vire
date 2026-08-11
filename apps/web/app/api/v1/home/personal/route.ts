import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService } from '@vire/core';
import { type PersonalBlockResponse } from '@vire/api-contracts';

export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const result = await service.personalBlock({ userId: session.user.id });
  return NextResponse.json(result satisfies PersonalBlockResponse);
}
