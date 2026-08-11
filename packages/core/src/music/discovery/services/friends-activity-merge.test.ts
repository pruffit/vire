import { describe, it, expect } from 'vitest';
import { mergeFriendsActivity, friendActivityKey } from './friends-activity-merge';
import type { FriendActor, FriendLikeActivity, FriendFollowActivity, FriendPlaylistActivity } from '../types/home-blocks';

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
    expect(result[0]!.actor.id).toBe('b');
  });

  it('respects the limit', () => {
    const likes: FriendLikeActivity[] = Array.from({ length: 5 }, (_, i) => ({
      actor: actorA, at: new Date(2026, 0, i + 1), trackTitle: `T${i}`, artistName: 'Ar', artistSlug: 'ar', releaseId: `r${i}`,
    }));
    expect(mergeFriendsActivity(likes, [], [], 2)).toHaveLength(2);
  });

  it('defaults the limit to 12 when none is given', () => {
    const likes: FriendLikeActivity[] = Array.from({ length: 15 }, (_, i) => ({
      actor: actorA, at: new Date(2026, 0, i + 1), trackTitle: `T${i}`, artistName: 'Ar', artistSlug: 'ar', releaseId: `r${i}`,
    }));
    expect(mergeFriendsActivity(likes, [], [])).toHaveLength(12);
  });

  it('returns an empty array when likes/follows/playlists are all empty', () => {
    expect(mergeFriendsActivity([], [], [])).toEqual([]);
  });
});

describe('friendActivityKey', () => {
  it('stays stable and distinguishes actors on the same entity', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const k1 = friendActivityKey({ kind: 'like', actor: actorA, at, trackTitle: 'T', artistName: 'Ar', artistSlug: 'ar', releaseId: 'r' });
    const k2 = friendActivityKey({ kind: 'like', actor: actorB, at, trackTitle: 'T', artistName: 'Ar', artistSlug: 'ar', releaseId: 'r' });
    expect(k1).not.toBe(k2);
  });
});
