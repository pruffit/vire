export interface SearchArtist {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  firstReleaseCoverUrl: string | null;
  verified: boolean;
}

export interface SearchRelease {
  id: string;
  title: string;
  type: string;
  genre: string | null;
  coverUrl: string | null;
  artistSlug: string;
  artistName: string;
}

export interface SearchTrack {
  id: string;
  title: string;
  releaseId: string;
  artistSlug: string;
  artistName: string;
  coverUrl: string | null;
  version: string | null;
  feat: string[];
}

export interface SearchResults {
  artists: SearchArtist[];
  releases: SearchRelease[];
  tracks: SearchTrack[];
}
