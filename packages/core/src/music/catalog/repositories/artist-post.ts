import type { ArtistPost } from '../types/artist-post';

export interface IArtistPostRepository {
  create(input: { artistProfileId: string; title: string | null; body: string }): Promise<ArtistPost>;
  findById(id: string): Promise<ArtistPost | null>;
  update(id: string, patch: { title: string | null; body: string }): Promise<void>;
  delete(id: string): Promise<void>;
}
