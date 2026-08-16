import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService } from '@vire/core';
import { type HomePlaylistsResponse } from '@vire/api-contracts';

export async function GET() {
  const caller = await getCaller();
  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const result = await service.playlistsBlock({ viewerId: caller?.id });
  return NextResponse.json(result satisfies HomePlaylistsResponse);
}
