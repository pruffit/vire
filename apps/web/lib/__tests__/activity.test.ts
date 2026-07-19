import { describe, it, expect } from 'vitest';
import type {
  LikedTrack, FollowedArtist, PlaylistSummary,
  FriendActor, FriendLikeActivity, FriendFollowActivity, FriendPlaylistActivity,
} from '@vire/db';
import { mergeActivity, mergeFriendsActivity, friendActivityKey } from '../activity';

function like(overrides: Partial<LikedTrack> = {}): LikedTrack {
  return {
    id: 'track-1',
    title: 'Track title',
    durationSec: 180,
    releaseId: 'release-1',
    releaseCoverUrl: null,
    artistName: 'Artist',
    artistSlug: 'artist',
    accentColor: null,
    isExplicit: false,
    likedAt: new Date('2026-01-01T00:00:00Z'),
    version: null,
    feat: [],
    ...overrides,
  };
}

function follow(overrides: Partial<FollowedArtist> = {}): FollowedArtist {
  return {
    id: 'artist-1',
    slug: 'artist',
    name: 'Artist',
    avatarUrl: null,
    verified: false,
    followedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function playlist(overrides: Partial<PlaylistSummary> = {}): PlaylistSummary {
  return {
    id: 'playlist-1',
    title: 'Playlist title',
    visibility: 'PRIVATE',
    trackCount: 3,
    coverUrl: null,
    covers: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('mergeActivity', () => {
  it('sorts all kinds by time, most recent first', () => {
    const likes = [like({ id: 'l1', likedAt: new Date('2026-01-01T00:00:00Z') })];
    const follows = [follow({ id: 'f1', followedAt: new Date('2026-01-03T00:00:00Z') })];
    const playlists = [playlist({ id: 'p1', createdAt: new Date('2026-01-02T00:00:00Z') })];

    const result = mergeActivity(likes, follows, playlists);

    expect(result.map((r) => r.kind)).toEqual(['follow', 'playlist', 'like']);
  });

  it('respects the limit', () => {
    const likes = Array.from({ length: 5 }, (_, i) =>
      like({ id: `l${i}`, likedAt: new Date(2026, 0, i + 1) }),
    );

    const result = mergeActivity(likes, [], [], 2);

    expect(result).toHaveLength(2);
    // Two most recent likes (Jan 5 and Jan 4)
    expect(result[0].kind === 'like' && result[0].trackTitle).toBe('Track title');
    expect(result.map((r) => (r.kind === 'like' ? r.at.getDate() : null))).toEqual([5, 4]);
  });

  it('maps each kind to its expected shape', () => {
    const likes = [
      like({
        id: 'l1',
        title: 'My Song',
        artistName: 'My Artist',
        artistSlug: 'my-artist',
        releaseId: 'release-x',
        likedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    ];
    const follows = [
      follow({
        name: 'Followed Artist',
        slug: 'followed-artist',
        followedAt: new Date('2026-01-02T00:00:00Z'),
      }),
    ];
    const playlists = [
      playlist({
        id: 'playlist-x',
        title: 'My Playlist',
        createdAt: new Date('2026-01-03T00:00:00Z'),
      }),
    ];

    const result = mergeActivity(likes, follows, playlists);

    expect(result).toEqual([
      { kind: 'playlist', at: new Date('2026-01-03T00:00:00Z'), playlistId: 'playlist-x', title: 'My Playlist' },
      { kind: 'follow', at: new Date('2026-01-02T00:00:00Z'), artistName: 'Followed Artist', artistSlug: 'followed-artist' },
      {
        kind: 'like',
        at: new Date('2026-01-01T00:00:00Z'),
        trackTitle: 'My Song',
        artistName: 'My Artist',
        artistSlug: 'my-artist',
        releaseId: 'release-x',
      },
    ]);
  });
});

const actorA: FriendActor = { id: 'a', name: 'Аня', image: null };
const actorB: FriendActor = { id: 'b', name: 'Боря', image: null };

describe('mergeFriendsActivity', () => {
  it('sorts all kinds by time across actors, most recent first', () => {
    const likes: FriendLikeActivity[] = [
      { actor: actorA, at: new Date('2026-01-01T00:00:00Z'), trackTitle: 'T', artistName: 'Ar', artistSlug: 'ar', releaseId: 'r' },
    ];
    const follows: FriendFollowActivity[] = [
      { actor: actorB, at: new Date('2026-01-03T00:00:00Z'), artistName: 'Ar2', artistSlug: 'ar2' },
    ];
    const playlists: FriendPlaylistActivity[] = [
      { actor: actorA, at: new Date('2026-01-02T00:00:00Z'), playlistId: 'p', title: 'P' },
    ];

    const result = mergeFriendsActivity(likes, follows, playlists);
    expect(result.map((r) => r.kind)).toEqual(['follow', 'playlist', 'like']);
    expect(result[0].actor.id).toBe('b');
  });

  it('respects the limit', () => {
    const likes: FriendLikeActivity[] = Array.from({ length: 5 }, (_, i) => ({
      actor: actorA, at: new Date(2026, 0, i + 1), trackTitle: `T${i}`, artistName: 'Ar', artistSlug: 'ar', releaseId: `r${i}`,
    }));
    expect(mergeFriendsActivity(likes, [], [], 2)).toHaveLength(2);
  });

  it('key stays stable and distinguishes actors on the same entity', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const k1 = friendActivityKey({ kind: 'like', actor: actorA, at, trackTitle: 'T', artistName: 'Ar', artistSlug: 'ar', releaseId: 'r' });
    const k2 = friendActivityKey({ kind: 'like', actor: actorB, at, trackTitle: 'T', artistName: 'Ar', artistSlug: 'ar', releaseId: 'r' });
    expect(k1).not.toBe(k2);
  });
});
