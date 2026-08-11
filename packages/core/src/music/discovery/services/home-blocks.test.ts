import { describe, it, expect, vi } from 'vitest';
import {
  HomeBlocksService,
  FRESH_RELEASES_WEEK_SINCE_DAYS,
  FRESH_RELEASES_WEEK_LIMIT,
  FRESH_RELEASES_LATEST_LIMIT,
  UPCOMING_LIMIT,
  HOT_TRACKS_SINCE_DAYS,
  HOT_TRACKS_LIMIT,
  PLAYLISTS_EDITORIAL_LIMIT,
  PLAYLISTS_PERSONAL_LIMIT,
  PLAYLISTS_PUBLIC_LIMIT,
} from './home-blocks';
import type { IHomeBlocksRepository } from '../repositories/home-blocks';
import type { HomePlaylistCard } from '../types/home-blocks';
import type { ReleaseCard } from '../../catalog/types/release-card';

function makeCard(overrides?: Partial<ReleaseCard>): ReleaseCard {
  return {
    id: 'release-1',
    title: 'Test Release',
    type: 'ALBUM',
    coverUrl: null,
    releaseDate: null,
    artistName: 'Test Artist',
    artistSlug: 'test-artist',
    artistAvatarUrl: null,
    hasExplicit: false,
    accentColor: null,
    ...overrides,
  };
}

function makePlaylist(overrides?: Partial<HomePlaylistCard>): HomePlaylistCard {
  return {
    id: 'playlist-1',
    title: 'Test Playlist',
    description: null,
    kind: 'TRENDING',
    editorialParams: null,
    trackCount: 10,
    likesCount: 0,
    covers: [],
    ...overrides,
  };
}

function makeRepo(overrides?: Partial<IHomeBlocksRepository>): IHomeBlocksRepository {
  return {
    latestReleases: vi.fn().mockResolvedValue([]),
    freshReleases: vi.fn().mockResolvedValue([]),
    upcomingReleases: vi.fn().mockResolvedValue([]),
    popularTracks: vi.fn().mockResolvedValue([]),
    editorialPlaylists: vi.fn().mockResolvedValue([]),
    personalPlaylists: vi.fn().mockResolvedValue([]),
    popularPlaylists: vi.fn().mockResolvedValue([]),
    publicUserPlaylists: vi.fn().mockResolvedValue([]),
    likedPlaylistIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('HomeBlocksService.freshReleasesBlock', () => {
  it('excludes the featured release (first of latest) from the week list', async () => {
    const featured = makeCard({ id: 'featured' });
    const rest = makeCard({ id: 'week-1' });
    const repo = makeRepo({
      latestReleases: vi.fn().mockResolvedValue([featured, rest]),
      freshReleases: vi.fn().mockResolvedValue([featured, rest, makeCard({ id: 'week-2' }), makeCard({ id: 'week-3' })]),
    });

    const result = await new HomeBlocksService(repo).freshReleasesBlock();

    expect(result.some((r) => r.id === 'featured')).toBe(false);
    expect(repo.freshReleases).toHaveBeenCalledWith({ sinceDays: FRESH_RELEASES_WEEK_SINCE_DAYS, limit: FRESH_RELEASES_WEEK_LIMIT });
    expect(repo.latestReleases).toHaveBeenCalledWith(FRESH_RELEASES_LATEST_LIMIT);
  });

  it('falls back to the tail of latest releases when the week is thin (below the minimum of 4)', async () => {
    const latest = Array.from({ length: 6 }, (_, i) => makeCard({ id: `latest-${i}` }));
    const repo = makeRepo({
      latestReleases: vi.fn().mockResolvedValue(latest),
      freshReleases: vi.fn().mockResolvedValue([makeCard({ id: 'week-1' }), makeCard({ id: 'week-2' })]),
    });

    const result = await new HomeBlocksService(repo).freshReleasesBlock();

    expect(result.map((r) => r.id)).toEqual(latest.slice(1).map((r) => r.id));
  });

  it('uses the week list as-is when it clears the minimum of 4, ignoring the latest tail', async () => {
    const week = Array.from({ length: 5 }, (_, i) => makeCard({ id: `week-${i}` }));
    const repo = makeRepo({
      latestReleases: vi.fn().mockResolvedValue([makeCard({ id: 'featured' })]),
      freshReleases: vi.fn().mockResolvedValue(week),
    });

    const result = await new HomeBlocksService(repo).freshReleasesBlock();

    expect(result.map((r) => r.id)).toEqual(week.map((r) => r.id));
  });

  it('trims the result to the 18-item result limit', async () => {
    const week = Array.from({ length: 30 }, (_, i) => makeCard({ id: `week-${i}` }));
    const repo = makeRepo({
      latestReleases: vi.fn().mockResolvedValue([]),
      freshReleases: vi.fn().mockResolvedValue(week),
    });

    const result = await new HomeBlocksService(repo).freshReleasesBlock();

    expect(result).toHaveLength(18);
  });
});

describe('HomeBlocksService.upcomingBlock', () => {
  it('delegates to the port with the upcoming limit', async () => {
    const repo = makeRepo();
    await new HomeBlocksService(repo).upcomingBlock();
    expect(repo.upcomingReleases).toHaveBeenCalledWith(UPCOMING_LIMIT);
  });
});

describe('HomeBlocksService.hotTracksBlock', () => {
  it('delegates to the port with the 30-day/20-item chart window', async () => {
    const repo = makeRepo();
    await new HomeBlocksService(repo).hotTracksBlock();
    expect(repo.popularTracks).toHaveBeenCalledWith(HOT_TRACKS_SINCE_DAYS, HOT_TRACKS_LIMIT);
  });
});

describe('HomeBlocksService.playlistsBlock — гость', () => {
  it('does not call personalPlaylists or likedPlaylistIds without a viewerId', async () => {
    const repo = makeRepo();
    await new HomeBlocksService(repo).playlistsBlock({});

    expect(repo.personalPlaylists).not.toHaveBeenCalled();
    expect(repo.likedPlaylistIds).not.toHaveBeenCalled();
  });

  it('still fills the personal slot with popular playlists for a guest (empty personal)', async () => {
    const shared = [makePlaylist({ id: 'shared-1' })];
    const popular = [makePlaylist({ id: 'popular-1' }), makePlaylist({ id: 'popular-2' })];
    const repo = makeRepo({
      editorialPlaylists: vi.fn().mockResolvedValue(shared),
      popularPlaylists: vi.fn().mockResolvedValue(popular),
    });

    const result = await new HomeBlocksService(repo).playlistsBlock({});

    expect(repo.popularPlaylists).toHaveBeenCalledWith(PLAYLISTS_PERSONAL_LIMIT, ['shared-1']);
    expect(result.playlists.map((p) => p.id)).toEqual(['shared-1', 'popular-1', 'popular-2']);
    expect(result.likedPlaylistIds).toEqual([]);
  });
});

describe('HomeBlocksService.playlistsBlock — добор популярными', () => {
  it('tops off with popular playlists only when personal playlists are short of the limit', async () => {
    const personal = [makePlaylist({ id: 'p1' }), makePlaylist({ id: 'p2' })];
    const repo = makeRepo({
      personalPlaylists: vi.fn().mockResolvedValue(personal),
      popularPlaylists: vi.fn().mockResolvedValue([makePlaylist({ id: 'fill-1' })]),
    });

    const result = await new HomeBlocksService(repo).playlistsBlock({ viewerId: 'user-1' });

    expect(repo.personalPlaylists).toHaveBeenCalledWith('user-1', PLAYLISTS_PERSONAL_LIMIT);
    expect(repo.popularPlaylists).toHaveBeenCalledWith(PLAYLISTS_PERSONAL_LIMIT - personal.length, ['p1', 'p2']);
    expect(result.playlists.map((p) => p.id)).toContain('fill-1');
  });

  it('does not call popularPlaylists when personal playlists already meet the limit', async () => {
    const personal = Array.from({ length: PLAYLISTS_PERSONAL_LIMIT }, (_, i) => makePlaylist({ id: `p${i}` }));
    const repo = makeRepo({ personalPlaylists: vi.fn().mockResolvedValue(personal) });

    await new HomeBlocksService(repo).playlistsBlock({ viewerId: 'user-1' });

    expect(repo.popularPlaylists).not.toHaveBeenCalled();
  });
});

describe('HomeBlocksService.playlistsBlock — дедуп', () => {
  it('deduplicates playlists shared across shared/personal/public sources, keeping the first occurrence order', async () => {
    const shared = [makePlaylist({ id: 'dup', title: 'Shared version' })];
    const personal = Array.from({ length: PLAYLISTS_PERSONAL_LIMIT }, (_, i) =>
      i === 0 ? makePlaylist({ id: 'dup', title: 'Personal version' }) : makePlaylist({ id: `personal-${i}` }));
    const publicPlaylists = [makePlaylist({ id: 'dup', title: 'Public version' }), makePlaylist({ id: 'public-1' })];
    const repo = makeRepo({
      editorialPlaylists: vi.fn().mockResolvedValue(shared),
      personalPlaylists: vi.fn().mockResolvedValue(personal),
      publicUserPlaylists: vi.fn().mockResolvedValue(publicPlaylists),
    });

    const result = await new HomeBlocksService(repo).playlistsBlock({ viewerId: 'user-1' });

    const dupOccurrences = result.playlists.filter((p) => p.id === 'dup');
    expect(dupOccurrences).toHaveLength(1);
    expect(dupOccurrences[0]!.title).toBe('Shared version');
    expect(result.playlists.map((p) => p.id)).toContain('public-1');
  });

  it('requests editorial/public playlists with their limits and returns liked ids for a signed-in viewer', async () => {
    const repo = makeRepo({ likedPlaylistIds: vi.fn().mockResolvedValue(['liked-1']) });

    const result = await new HomeBlocksService(repo).playlistsBlock({ viewerId: 'user-1' });

    expect(repo.editorialPlaylists).toHaveBeenCalledWith(PLAYLISTS_EDITORIAL_LIMIT);
    expect(repo.publicUserPlaylists).toHaveBeenCalledWith(PLAYLISTS_PUBLIC_LIMIT);
    expect(repo.likedPlaylistIds).toHaveBeenCalledWith('user-1');
    expect(result.likedPlaylistIds).toEqual(['liked-1']);
  });
});
