import type { ArtistProfile } from './artist';
import type { Release, Track } from './release';

export interface ReleasePageView {
  artist: ArtistProfile;
  release: Release;
  tracks: Track[];
  isReleased: boolean;
  showCountdown: boolean;
  presaved: boolean;
}
