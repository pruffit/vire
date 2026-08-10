import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTranslator } from '@vire/i18n/translator';

const t = await getTranslator('ru', 'playlist');
const notFoundTitle = t('notFound');

const { getPlaylistWithTracks, auth, getForViewer } = vi.hoisted(() => ({
  getPlaylistWithTracks: vi.fn(),
  auth: vi.fn(),
  getForViewer: vi.fn(),
}));

vi.mock('@vire/db', () => ({ getPlaylistWithTracks, getPlaylistLikeState: vi.fn(), getUserProfile: vi.fn() }));
vi.mock('@/auth', () => ({ auth }));
vi.mock('@/lib/playlist', () => ({ playlistService: () => ({ getForViewer }) }));

import { generateMetadata } from './page';

const params = Promise.resolve({ id: 'p1' });
const noQuery = Promise.resolve({});
const privatePlaylist = {
  id: 'p1',
  title: 'Секретный плейлист',
  description: null,
  coverUrl: null,
  visibility: 'PRIVATE' as const,
  ownerUserId: 'owner-1',
  likesCount: 0,
  isCollaborative: false,
  version: 0,
  tracks: [],
};

const denied = { ok: false as const, error: new Error('forbidden') };
const allowed = { ok: true as const, value: privatePlaylist };

beforeEach(() => vi.clearAllMocks());

describe('generateMetadata /playlists/[id]', () => {
  it('чужой аноним не получает название приватного плейлиста', async () => {
    getPlaylistWithTracks.mockResolvedValue(privatePlaylist);
    auth.mockResolvedValue(null);
    getForViewer.mockResolvedValue(denied);
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe(notFoundTitle);
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });

  it('чужой залогиненный юзер не получает название приватного плейлиста', async () => {
    getPlaylistWithTracks.mockResolvedValue(privatePlaylist);
    auth.mockResolvedValue({ user: { id: 'other-user' } });
    getForViewer.mockResolvedValue(denied);
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe(notFoundTitle);
  });

  it('владелец получает название приватного плейлиста + noindex', async () => {
    getPlaylistWithTracks.mockResolvedValue(privatePlaylist);
    auth.mockResolvedValue({ user: { id: 'owner-1' } });
    getForViewer.mockResolvedValue(allowed);
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe('Секретный плейлист');
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('приглашённый по ссылке видит название, но страница остаётся noindex', async () => {
    getPlaylistWithTracks.mockResolvedValue({ ...privatePlaylist, isCollaborative: true });
    auth.mockResolvedValue(null);
    getForViewer.mockResolvedValue(allowed);
    const meta = await generateMetadata({ params, searchParams: Promise.resolve({ join: 'tok' }) });
    expect(meta.title).toBe('Секретный плейлист');
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(getForViewer).toHaveBeenCalledWith('p1', null, 'tok');
  });

  it('публичный плейлист не трогает auth() и отдаёт полную метадату', async () => {
    getPlaylistWithTracks.mockResolvedValue({ ...privatePlaylist, visibility: 'PUBLIC' });
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe('Секретный плейлист');
    expect(auth).not.toHaveBeenCalled();
  });

  it('несуществующий плейлист — нейтральная метадата', async () => {
    getPlaylistWithTracks.mockResolvedValue(null);
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe(notFoundTitle);
    expect(auth).not.toHaveBeenCalled();
  });
});
