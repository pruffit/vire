import { NextResponse } from 'next/server';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService } from '@vire/core';
import { type HotTracksResponse } from '@vire/api-contracts';

export async function GET() {
  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const items = await service.hotTracksBlock();
  return NextResponse.json({ items } satisfies HotTracksResponse);
}
