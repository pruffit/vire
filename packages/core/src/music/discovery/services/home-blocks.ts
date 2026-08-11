import type { ReleaseCard } from '../../catalog/types/release-card';
import type { IHomeBlocksRepository } from '../repositories/home-blocks';
import type { HomeChartTrack, HomePlaylistsBlock, HomePersonalBlock, FriendActivityItem } from '../types/home-blocks';
import { mergeFriendsActivity, FRIENDS_ACTIVITY_LIMIT } from './friends-activity-merge';

export const FRESH_RELEASES_LATEST_LIMIT = 19;
export const FRESH_RELEASES_WEEK_SINCE_DAYS = 7;
export const FRESH_RELEASES_WEEK_LIMIT = 18;
export const FRESH_RELEASES_MIN_WEEK_COUNT = 4;
export const FRESH_RELEASES_RESULT_LIMIT = 18;

export const UPCOMING_LIMIT = 8;

export const HOT_TRACKS_SINCE_DAYS = 30;
export const HOT_TRACKS_LIMIT = 20;

export const PLAYLISTS_EDITORIAL_LIMIT = 4;
export const PLAYLISTS_PERSONAL_LIMIT = 4;
export const PLAYLISTS_PUBLIC_LIMIT = 12;

export const PERSONAL_RECENT_LIMIT = 12;
export const PERSONAL_PICKS_LIMIT = 12;
export const PERSONAL_PICKS_MIN_COUNT = 4;

export interface PlaylistsBlockInput {
  viewerId?: string;
}

export class HomeBlocksService {
  constructor(private readonly repo: IHomeBlocksRepository) {}

  /** featured = первый из последних; неделя без featured, при нехватке (<4) — хвост последних. */
  async freshReleasesBlock(): Promise<ReleaseCard[]> {
    const [freshWeek, latest] = await Promise.all([
      this.repo.freshReleases({ sinceDays: FRESH_RELEASES_WEEK_SINCE_DAYS, limit: FRESH_RELEASES_WEEK_LIMIT }),
      this.repo.latestReleases(FRESH_RELEASES_LATEST_LIMIT),
    ]);
    const featured = latest[0] ?? null;
    // на маленьком каталоге неделя бывает пустой — добиваем общим списком свежего
    const weekFresh = freshWeek.filter((r) => r.id !== featured?.id);
    const rest = weekFresh.length >= FRESH_RELEASES_MIN_WEEK_COUNT ? weekFresh : latest.slice(1);
    return rest.slice(0, FRESH_RELEASES_RESULT_LIMIT);
  }

  upcomingBlock(): Promise<ReleaseCard[]> {
    return this.repo.upcomingReleases(UPCOMING_LIMIT);
  }

  hotTracksBlock(): Promise<HomeChartTrack[]> {
    return this.repo.popularTracks(HOT_TRACKS_SINCE_DAYS, HOT_TRACKS_LIMIT);
  }

  /** 4 редакционных + 4 личных (добор популярным при нехватке) + плейлисты слушателей, дедуп по id. */
  async playlistsBlock({ viewerId }: PlaylistsBlockInput): Promise<HomePlaylistsBlock> {
    const [sharedPlaylists, personalRaw, publicPlaylists, likedPlaylistIds] = await Promise.all([
      this.repo.editorialPlaylists(PLAYLISTS_EDITORIAL_LIMIT),
      viewerId ? this.repo.personalPlaylists(viewerId, PLAYLISTS_PERSONAL_LIMIT) : Promise.resolve([]),
      this.repo.publicUserPlaylists(PLAYLISTS_PUBLIC_LIMIT),
      viewerId ? this.repo.likedPlaylistIds(viewerId) : Promise.resolve([] as string[]),
    ]);

    let personalPlaylists = personalRaw;
    if (personalPlaylists.length < PLAYLISTS_PERSONAL_LIMIT) {
      const exclude = [...sharedPlaylists, ...personalPlaylists].map((p) => p.id);
      const fill = await this.repo.popularPlaylists(PLAYLISTS_PERSONAL_LIMIT - personalPlaylists.length, exclude);
      personalPlaylists = [...personalPlaylists, ...fill];
    }

    const seen = new Set<string>();
    const playlists = [...sharedPlaylists, ...personalPlaylists, ...publicPlaylists]
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

    return { playlists, likedPlaylistIds };
  }

  /** «Продолжить слушать» + «Для тебя» минус пересечение с недавним; «для тебя» скрыт при <4 после дедупа. */
  async personalBlock({ userId }: { userId: string }): Promise<HomePersonalBlock> {
    const [recentlyPlayed, personalPicksRaw] = await Promise.all([
      this.repo.recentlyPlayed(userId, PERSONAL_RECENT_LIMIT),
      this.repo.personalTrackPicks(userId, PERSONAL_PICKS_LIMIT),
    ]);
    const recentIds = new Set(recentlyPlayed.map((t) => t.id));
    const deduped = personalPicksRaw.filter((t) => !recentIds.has(t.id));
    return { recentlyPlayed, personalPicks: deduped.length >= PERSONAL_PICKS_MIN_COUNT ? deduped : [] };
  }

  async friendsActivityBlock({ userId }: { userId: string }): Promise<FriendActivityItem[]> {
    const raw = await this.repo.friendsActivity(userId, FRIENDS_ACTIVITY_LIMIT);
    return mergeFriendsActivity(raw.likes, raw.follows, raw.playlists);
  }
}
