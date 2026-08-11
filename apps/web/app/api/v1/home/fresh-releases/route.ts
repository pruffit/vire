import { NextResponse } from 'next/server';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService, type ReleaseCard } from '@vire/core';
import { type FreshReleasesResponse } from '@vire/api-contracts';

function toResponse(items: ReleaseCard[]): FreshReleasesResponse {
  return { items: items.map((r) => ({ ...r, releaseDate: r.releaseDate?.toISOString() ?? null })) };
}

export async function GET() {
  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const items = await service.freshReleasesBlock();
  return NextResponse.json(toResponse(items));
}
