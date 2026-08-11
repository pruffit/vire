import type { ArtistProfile } from '../types/artist';
import type { ReleaseWithTracks } from '../types/release';

/** Read-порт для экрана релиза (Server Component и HTTP-роут читают через одну реализацию). */
export interface IReleaseReadRepository {
  findArtistBySlug(slug: string): Promise<ArtistProfile | null>;
  findArtistById(id: string): Promise<ArtistProfile | null>;
  findReleaseWithTracks(releaseId: string): Promise<ReleaseWithTracks | null>;
  isPresaved(userId: string, releaseId: string): Promise<boolean>;
  hasPublishedTrack(artistId: string): Promise<boolean>;
  isMember(artistId: string, userId: string): Promise<boolean>;
}
