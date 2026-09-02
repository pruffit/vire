import type { IHomeBlocksRepository, ReleaseCard, HomeChartTrack, HomePlaylistCard, FriendsActivity } from '@vire/core';
import { getLatestReleases, listReleases, getUpcomingReleases, getPopularTracks, getRecentlyPlayed, getPersonalTrackPicks } from '../queries/discovery';
import { getLikedPlaylistIds } from '../queries/playlists';
import { getEditorialPlaylists, getPersonalPlaylists, getPopularPlaylists, getPublicUserPlaylists } from '../queries/playlist-editorial';
import { getFriendsActivity } from '../queries/friends-activity';

/** Тонкая обёртка над queries/discovery.ts и queries/playlists.ts — SQL живёт там, не здесь. */
export class DrizzleHomeBlocksRepository implements IHomeBlocksRepository {
  latestReleases(limit: number): Promise<ReleaseCard[]> {
    return getLatestReleases(limit);
  }

  freshReleases({ sinceDays, limit }: { sinceDays: number; limit: number }): Promise<ReleaseCard[]> {
    return listReleases({ sort: 'fresh', sinceDays, limit });
  }

  upcomingReleases(limit: number): Promise<ReleaseCard[]> {
    return getUpcomingReleases(limit);
  }

  popularTracks(sinceDays: number, limit: number): Promise<HomeChartTrack[]> {
    return getPopularTracks(sinceDays, limit);
  }

  editorialPlaylists(limit: number): Promise<HomePlaylistCard[]> {
    return getEditorialPlaylists(limit);
  }

  personalPlaylists(userId: string, limit: number): Promise<HomePlaylistCard[]> {
    return getPersonalPlaylists(userId, limit);
  }

  popularPlaylists(limit: number, excludeIds: string[]): Promise<HomePlaylistCard[]> {
    return getPopularPlaylists(limit, excludeIds);
  }

  publicUserPlaylists(limit: number): Promise<HomePlaylistCard[]> {
    return getPublicUserPlaylists(limit);
  }

  likedPlaylistIds(userId: string): Promise<string[]> {
    return getLikedPlaylistIds(userId);
  }

  recentlyPlayed(userId: string, limit: number): Promise<HomeChartTrack[]> {
    return getRecentlyPlayed(userId, limit);
  }

  personalTrackPicks(userId: string, limit: number): Promise<HomeChartTrack[]> {
    return getPersonalTrackPicks(userId, limit);
  }

  friendsActivity(userId: string, limit: number): Promise<FriendsActivity> {
    return getFriendsActivity(userId, limit);
  }
}
