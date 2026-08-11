import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService } from '@vire/core';
import { type HomePlaylistsResponse } from '@vire/api-contracts';

export async function GET() {
  const session = await auth();
  const service = new HomeBlocksService(new DrizzleHomeBlocksRepository());
  const result = await service.playlistsBlock({ viewerId: session?.user?.id });
  return NextResponse.json(result satisfies HomePlaylistsResponse);
}
