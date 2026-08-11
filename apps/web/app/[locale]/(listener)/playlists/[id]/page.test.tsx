import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTranslator } from '@vire/i18n/translator';

const t = await getTranslator('ru', 'playlist');
const notFoundTitle = t('notFound');

const { getPlaylistPage, auth } = vi.hoisted(() => ({
  getPlaylistPage: vi.fn(),
  auth: vi.fn(),
}));

vi.mock('@/lib/playlist-page', () => ({ getPlaylistPage }));
vi.mock('@/auth', () => ({ auth }));

import { generateMetadata } from './page';

const params = Promise.resolve({ id: 'p1' });
const noQuery = Promise.resolve({});
const privatePlaylist: {
  id: string; title: string; description: string | null; coverUrl: string | null;
  kind: string; editorialParams: null; visibility: 'PRIVATE' | 'PUBLIC'; ownerUserId: string;
  likesCount: number; isCollaborative: boolean; version: number; tracks: never[];
} = {
  id: 'p1',
  title: 'Секретный плейлист',
  description: null,
  coverUrl: null,
  kind: 'USER',
  editorialParams: null,
  visibility: 'PRIVATE',
  ownerUserId: 'owner-1',
  likesCount: 0,
  isCollaborative: false,
  version: 0,
  tracks: [],
};

function playlistView(overrides: Partial<typeof privatePlaylist> = {}) {
  return {
    kind: 'playlist' as const,
    playlist: { ...privatePlaylist, ...overrides },
    role: 'VIEWER' as const,
    collaborators: [],
    liked: false,
    invite: null,
    inviterName: null,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('generateMetadata /playlists/[id]', () => {
  it('чужой аноним не получает название приватного плейлиста', async () => {
    auth.mockResolvedValue(null);
    getPlaylistPage.mockResolvedValue(null);
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe(notFoundTitle);
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });

  it('чужой залогиненный юзер не получает название приватного плейлиста', async () => {
    auth.mockResolvedValue({ user: { id: 'other-user' } });
    getPlaylistPage.mockResolvedValue(null);
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe(notFoundTitle);
  });

  it('владелец получает название приватного плейлиста + noindex', async () => {
    auth.mockResolvedValue({ user: { id: 'owner-1' } });
    getPlaylistPage.mockResolvedValue(playlistView());
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe('Секретный плейлист');
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('вошедший приглашённый видит название, но страница остаётся noindex', async () => {
    auth.mockResolvedValue(null);
    getPlaylistPage.mockResolvedValue(playlistView({ isCollaborative: true }));
    const meta = await generateMetadata({ params, searchParams: Promise.resolve({ join: 'tok' }) });
    expect(meta.title).toBe('Секретный плейлист');
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(getPlaylistPage).toHaveBeenCalledWith('p1', null, 'tok');
  });

  it('аноним с валидным токеном (kind invite) — нейтральная метадата', async () => {
    auth.mockResolvedValue(null);
    getPlaylistPage.mockResolvedValue({ kind: 'invite', title: 'Секретный плейлист', ownerUserId: 'owner-1' });
    const meta = await generateMetadata({ params, searchParams: Promise.resolve({ join: 'tok' }) });
    expect(meta.title).toBe(notFoundTitle);
  });

  it('публичный плейлист отдаёт полную метадату', async () => {
    auth.mockResolvedValue(null);
    getPlaylistPage.mockResolvedValue(playlistView({ visibility: 'PUBLIC' }));
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe('Секретный плейлист');
  });

  it('несуществующий плейлист — нейтральная метадата', async () => {
    auth.mockResolvedValue(null);
    getPlaylistPage.mockResolvedValue(null);
    const meta = await generateMetadata({ params, searchParams: noQuery });
    expect(meta.title).toBe(notFoundTitle);
  });
});
