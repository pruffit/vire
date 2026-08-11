import { cache } from 'react';
import { db, DrizzlePlaylistPageRepository } from '@vire/db';
import { PlaylistPageService, type PlaylistPageView } from '@vire/core';
import { playlistService } from '@/lib/playlist';

export const getPlaylistPage = cache(async (
  id: string,
  viewerId: string | null,
  joinToken?: string,
): Promise<PlaylistPageView | null> => {
  const service = new PlaylistPageService(playlistService(), new DrizzlePlaylistPageRepository(db));
  const result = await service.getPage({ playlistId: id, viewerId, joinToken });
  return result.ok ? result.value : null;
});
