/** Форма — зеркало ArtistListItem (packages/db/src/queries/artists.ts): порт отдаёт те же поля. */
export interface ArtistCard {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  firstReleaseCoverUrl: string | null;
  verified: boolean;
  releaseCount: number;
  genres: string[];
}
