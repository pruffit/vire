import type { DB } from '../client';
import type { IFollowRepository } from '@vire/core';
import { followArtist, unfollowArtist } from '../queries/follows';

export class DrizzleFollowRepository implements IFollowRepository {
  constructor(private readonly db: DB) {}

  follow(userId: string, artistProfileId: string): Promise<void> {
    return followArtist(userId, artistProfileId);
  }

  unfollow(userId: string, artistProfileId: string): Promise<void> {
    return unfollowArtist(userId, artistProfileId);
  }
}
