import type { DB } from '../client';
import type { IPlaylistPageRepository } from '@vire/core';
import { getPlaylistLikeState } from '../queries/playlists';
import { getUserProfile } from '../queries/profile';

/** Тонкие обёртки над существующими query-функциями — SQL живёт в queries/*, не здесь. */
export class DrizzlePlaylistPageRepository implements IPlaylistPageRepository {
  constructor(private readonly db: DB) {}

  likeState(userId: string, playlistId: string): Promise<boolean> {
    return getPlaylistLikeState(userId, playlistId);
  }

  async userName(userId: string): Promise<string | null> {
    const profile = await getUserProfile(userId);
    return profile?.name ?? null;
  }
}
