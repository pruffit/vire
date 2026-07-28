import { describe, it, expect } from 'vitest';
import {
  friendSignal,
  tasteOverlapScore,
  scoreDiscoveryArtist,
  discoveryReason,
  composeDiscovery,
  W_CO_LISTEN,
  W_TASTE_OVERLAP,
  W_FRIEND_SIGNAL,
} from './discovery-scoring';
import type { DiscoveryCandidate } from '../types/discovery';

function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    artistProfileId: 'artist-1',
    artistSlug: 'artist-1',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    verified: false,
    coListen: 0,
    tasteOverlap: 0,
    friendListeners: 0,
    sourceArtistId: 'artist-1',
    ...overrides,
  };
}

describe('friendSignal', () => {
  it('saturates at 3 friends and stays at 1 beyond that', () => {
    expect(friendSignal(3)).toBe(1);
    expect(friendSignal(6)).toBe(1);
  });

  it('grows linearly below saturation', () => {
    expect(friendSignal(1)).toBeCloseTo(1 / 3);
    expect(friendSignal(2)).toBeCloseTo(2 / 3);
  });

  it('is 0 for no friends and clamps negative input', () => {
    expect(friendSignal(0)).toBe(0);
    expect(friendSignal(-2)).toBe(0);
  });
});

describe('tasteOverlapScore', () => {
  it('is 1 for identical genre+mood sets', () => {
    const sig = { genres: ['rock', 'indie'], moods: ['CHILL'] };
    expect(tasteOverlapScore(sig, sig)).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(tasteOverlapScore(
      { genres: ['rock'], moods: [] },
      { genres: ['jazz'], moods: [] },
    )).toBe(0);
  });

  it('is 0 when either side has no tags', () => {
    expect(tasteOverlapScore({ genres: [], moods: [] }, { genres: ['rock'], moods: [] })).toBe(0);
    expect(tasteOverlapScore({ genres: ['rock'], moods: [] }, { genres: [], moods: [] })).toBe(0);
  });

  it('computes Jaccard over the combined genre+mood tag set', () => {
    // A = {rock, CHILL}, B = {rock, indie} -> intersection 1, union 3
    const score = tasteOverlapScore(
      { genres: ['rock'], moods: ['CHILL'] },
      { genres: ['rock', 'indie'], moods: [] },
    );
    expect(score).toBeCloseTo(1 / 3);
  });
});

describe('scoreDiscoveryArtist', () => {
  it('weighs the three signals per the design (0.45/0.35/0.20)', () => {
    const c = candidate({ coListen: 1, tasteOverlap: 1, friendListeners: 3 });
    expect(scoreDiscoveryArtist(c)).toBeCloseTo(W_CO_LISTEN + W_TASTE_OVERLAP + W_FRIEND_SIGNAL);
  });

  it('is 0 when no signal fires', () => {
    expect(scoreDiscoveryArtist(candidate())).toBe(0);
  });
});

describe('discoveryReason', () => {
  it('picks the most senior signal: friends beats similar beats taste', () => {
    expect(discoveryReason(candidate({ friendListeners: 1, coListen: 1, tasteOverlap: 1 }))).toBe('friends');
    expect(discoveryReason(candidate({ friendListeners: 0, coListen: 0.5, tasteOverlap: 1 }))).toBe('similar');
    expect(discoveryReason(candidate({ friendListeners: 0, coListen: 0, tasteOverlap: 0.5 }))).toBe('taste');
  });
});

describe('composeDiscovery', () => {
  it('returns empty output for empty input', () => {
    expect(composeDiscovery([])).toEqual([]);
  });

  it('dedupes by artistProfileId, keeping the higher score', () => {
    const candidates = [
      candidate({ artistProfileId: 'a', sourceArtistId: 's1', coListen: 0.2 }),
      candidate({ artistProfileId: 'a', sourceArtistId: 's2', coListen: 0.9 }),
    ];
    const out = composeDiscovery(candidates);
    expect(out).toHaveLength(1);
    expect(out[0]!.sourceArtistId).toBe('s2');
  });

  it('caps candidates per source at maxPerSource', () => {
    const candidates = Array.from({ length: 4 }, (_, i) =>
      candidate({ artistProfileId: `a${i}`, sourceArtistId: 'seed', coListen: 1 - i * 0.01 }));
    const out = composeDiscovery(candidates, { limit: 12, maxPerSource: 1 });
    expect(out).toHaveLength(1);
  });

  it('allows several sources to each contribute up to maxPerSource', () => {
    const candidates = [
      candidate({ artistProfileId: 'a1', sourceArtistId: 'seed-1', coListen: 0.9 }),
      candidate({ artistProfileId: 'a2', sourceArtistId: 'seed-2', coListen: 0.8 }),
    ];
    const out = composeDiscovery(candidates, { limit: 12, maxPerSource: 1 });
    expect(out.map((c) => c.artistProfileId).sort()).toEqual(['a1', 'a2']);
  });

  it('sorts the output by score descending and truncates to limit', () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      candidate({ artistProfileId: `a${i}`, sourceArtistId: `s${i}`, coListen: i * 0.2 }));
    const out = composeDiscovery(candidates, { limit: 3 });
    expect(out).toHaveLength(3);
    expect(out.map((c) => c.artistProfileId)).toEqual(['a4', 'a3', 'a2']);
  });
});
