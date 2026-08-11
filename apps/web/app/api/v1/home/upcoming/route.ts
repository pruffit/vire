import { NextResponse } from 'next/server';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService, type ReleaseCard } from '@vire/core';
import { type UpcomingResponse } from '@vire/api-contracts';

function toResponse(items: ReleaseCard[]): UpcomingResponse {
  return { items: items.map((r) => ({ ...r, releaseDate: r.releaseDate?.toISOString() ?? null })) };
}

export async function GET() {
  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const items = await service.upcomingBlock();
  return NextResponse.json(toResponse(items));
}
