import type { ReleaseCard } from '../../catalog/types/release-card';
import type { HomeChartTrack, HomePlaylistCard } from '../types/home-blocks';

export interface IHomeBlocksRepository {
  latestReleases(limit: number): Promise<ReleaseCard[]>;
  freshReleases(params: { sinceDays: number; limit: number }): Promise<ReleaseCard[]>;
  upcomingReleases(limit: number): Promise<ReleaseCard[]>;
  popularTracks(sinceDays: number, limit: number): Promise<HomeChartTrack[]>;
  editorialPlaylists(limit: number): Promise<HomePlaylistCard[]>;
  personalPlaylists(userId: string, limit: number): Promise<HomePlaylistCard[]>;
  popularPlaylists(limit: number, excludeIds: string[]): Promise<HomePlaylistCard[]>;
  publicUserPlaylists(limit: number): Promise<HomePlaylistCard[]>;
  likedPlaylistIds(userId: string): Promise<string[]>;
}
