import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserLastfmUsername, getLikedTracks, topTracks } = vi.hoisted(() => ({
  getUserLastfmUsername: vi.fn(),
  getLikedTracks: vi.fn(),
  topTracks: vi.fn(),
}));

vi.mock('@vire/db', () => ({ getUserLastfmUsername, getLikedTracks }));
vi.mock('./lastfm', () => ({ createLastfmTaste: () => ({ topTracks }) }));

import { tasteSuggestions } from './taste-suggestions';

beforeEach(() => vi.clearAllMocks());

const liked = (artistName: string, title: string) => ({
  id: 't', title, durationSec: null, releaseId: 'r', releaseCoverUrl: null, artistName, artistSlug: 'a',
  accentColor: null, isExplicit: false, likedAt: new Date(), version: null, feat: [],
});

describe('tasteSuggestions', () => {
  it('без привязанного ника отдаёт [] и не ходит в Last.fm', async () => {
    getUserLastfmUsername.mockResolvedValue(null);

    expect(await tasteSuggestions('u1', 8)).toEqual([]);
    expect(topTracks).not.toHaveBeenCalled();
  });

  it('пустой ответ Last.fm отдаёт []', async () => {
    getUserLastfmUsername.mockResolvedValue('user');
    topTracks.mockResolvedValue([]);
    getLikedTracks.mockResolvedValue([]);

    expect(await tasteSuggestions('u1', 8)).toEqual([]);
  });

  it('мапит хинты в кандидатов kind:HINT и дедупит с лайками по артист+название', async () => {
    getUserLastfmUsername.mockResolvedValue('user');
    topTracks.mockResolvedValue([
      { title: 'Песня A', artistName: 'Артист', coverUrl: null, durationSec: null },
      { title: 'Песня B', artistName: 'Артист', coverUrl: null, durationSec: null },
    ]);
    getLikedTracks.mockResolvedValue([liked('Артист', 'Песня A')]);

    const result = await tasteSuggestions('u1', 8);

    expect(result).toEqual([
      { kind: 'HINT', hint: { title: 'Песня B', artistName: 'Артист', coverUrl: null, durationSec: null } },
    ]);
  });

  it('уважает лимит после дедупа', async () => {
    getUserLastfmUsername.mockResolvedValue('user');
    topTracks.mockResolvedValue([
      { title: 'A', artistName: 'X', coverUrl: null, durationSec: null },
      { title: 'B', artistName: 'X', coverUrl: null, durationSec: null },
      { title: 'C', artistName: 'X', coverUrl: null, durationSec: null },
    ]);
    getLikedTracks.mockResolvedValue([]);

    const result = await tasteSuggestions('u1', 2);

    expect(result).toHaveLength(2);
  });
});
