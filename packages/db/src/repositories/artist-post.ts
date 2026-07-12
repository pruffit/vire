import type { DB } from '../client';
import type { IArtistPostRepository, ArtistPost } from '@vire/core';
import { createArtistPost, getArtistPostById, updateArtistPost, deleteArtistPost } from '../queries/posts';

export class DrizzleArtistPostRepository implements IArtistPostRepository {
  constructor(private readonly db: DB) {}

  create(input: { artistProfileId: string; title: string | null; body: string }): Promise<ArtistPost> {
    return createArtistPost(input);
  }

  findById(id: string): Promise<ArtistPost | null> {
    return getArtistPostById(id);
  }

  update(id: string, patch: { title: string | null; body: string }): Promise<void> {
    return updateArtistPost(id, patch);
  }

  delete(id: string): Promise<void> {
    return deleteArtistPost(id);
  }
}
