import type { ArtistProfile } from '../types/artist';

export interface IArtistRepository {
  findBySlug(slug: string): Promise<ArtistProfile | null>;
}
