export interface ArtistPost {
  id: string;
  artistProfileId: string;
  title: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}
