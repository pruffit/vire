import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPlaylistWithTracks, auth } = vi.hoisted(() => ({
  getPlaylistWithTracks: vi.fn(),
  auth: vi.fn(),
}));

vi.mock('@vire/db', () => ({ getPlaylistWithTracks, getPlaylistLikeState: vi.fn() }));
vi.mock('@/auth', () => ({ auth }));

import { generateMetadata } from './page';

const params = Promise.resolve({ id: 'p1' });
const privatePlaylist = {
  id: 'p1',
  title: 'Секретный плейлист',
  description: null,
  coverUrl: null,
  visibility: 'PRIVATE' as const,
  ownerUserId: 'owner-1',
  likesCount: 0,
  tracks: [],
};

beforeEach(() => vi.clearAllMocks());

describe('generateMetadata /playlists/[id]', () => {
  it('чужой аноним не получает название приватного плейлиста', async () => {
    getPlaylistWithTracks.mockResolvedValue(privatePlaylist);
    auth.mockResolvedValue(null);
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe('Не найдено');
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });

  it('чужой залогиненный юзер не получает название приватного плейлиста', async () => {
    getPlaylistWithTracks.mockResolvedValue(privatePlaylist);
    auth.mockResolvedValue({ user: { id: 'other-user' } });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe('Не найдено');
  });

  it('владелец получает название приватного плейлиста + noindex', async () => {
    getPlaylistWithTracks.mockResolvedValue(privatePlaylist);
    auth.mockResolvedValue({ user: { id: 'owner-1' } });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe('Секретный плейлист');
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('публичный плейлист не трогает auth() и отдаёт полную метадату', async () => {
    getPlaylistWithTracks.mockResolvedValue({ ...privatePlaylist, visibility: 'PUBLIC' });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe('Секретный плейлист');
    expect(auth).not.toHaveBeenCalled();
  });

  it('несуществующий плейлист — нейтральная метадата', async () => {
    getPlaylistWithTracks.mockResolvedValue(null);
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe('Не найдено');
    expect(auth).not.toHaveBeenCalled();
  });
});
