import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPlaylistWithTracks, getUserProfile, fetchCoverThumb, captured } = vi.hoisted(() => ({
  getPlaylistWithTracks: vi.fn(),
  getUserProfile: vi.fn(),
  fetchCoverThumb: vi.fn(async (url: string | null) => (url ? `thumb:${url}` : null)),
  captured: { element: null as unknown },
}));

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(element: unknown) {
      captured.element = element;
    }
  },
}));

vi.mock('@/lib/og/cover', () => ({ fetchCoverThumb }));

vi.mock('@vire/db', () => ({
  getPlaylistWithTracks,
  getUserProfile,
  pickCovers: (own: string | null, trackCovers: (string | null)[]) => {
    const unique = [...new Set(trackCovers.filter(Boolean) as string[])];
    return (own ? [own, ...unique.filter((c) => c !== own)] : unique).slice(0, 4);
  },
}));

import PlaylistOgImage from './opengraph-image';

function tree(): string {
  return JSON.stringify(captured.element);
}

const params = Promise.resolve({ id: 'p1' });

beforeEach(() => {
  vi.clearAllMocks();
  fetchCoverThumb.mockImplementation(async (url: string | null) => (url ? `thumb:${url}` : null));
  captured.element = null;
});

describe('OG-картинка плейлиста', () => {
  it('приватный плейлист не отдаёт ни названия, ни обложек', async () => {
    getPlaylistWithTracks.mockResolvedValue({
      id: 'p1',
      title: 'Секретная подборка',
      description: null,
      coverUrl: 'https://cdn.test/own.jpg',
      visibility: 'PRIVATE',
      ownerUserId: 'u1',
      likesCount: 0,
      tracks: [{ coverUrl: 'https://cdn.test/a.jpg' }],
    });

    await PlaylistOgImage({ params });

    const out = tree();
    expect(out).not.toContain('Секретная подборка');
    expect(out).not.toContain('cdn.test');
    expect(getUserProfile).not.toHaveBeenCalled();
    expect(fetchCoverThumb).not.toHaveBeenCalled();
  });

  it('несуществующий плейлист — нейтральный фон', async () => {
    getPlaylistWithTracks.mockResolvedValue(null);
    await PlaylistOgImage({ params });
    expect(tree()).toContain('VireMusic');
  });

  it('публичный плейлист отдаёт название, автора и уменьшенные обложки', async () => {
    getPlaylistWithTracks.mockResolvedValue({
      id: 'p1',
      title: 'Вечерний драйв',
      description: null,
      coverUrl: null,
      visibility: 'PUBLIC',
      ownerUserId: 'u1',
      likesCount: 0,
      tracks: [{ coverUrl: 'https://cdn.test/a.jpg' }, { coverUrl: 'https://cdn.test/b.jpg' }],
    });
    getUserProfile.mockResolvedValue({ name: 'Даня', image: null, createdAt: null });

    await PlaylistOgImage({ params });

    const out = tree();
    expect(out).toContain('Вечерний драйв');
    expect(out).toContain('Даня');
    expect(out).toContain('thumb:https://cdn.test/a.jpg');
    expect(fetchCoverThumb).toHaveBeenCalledWith('https://cdn.test/a.jpg');
  });

  it('обложка, для которой thumb не собрался, не рендерится сырой ссылкой', async () => {
    getPlaylistWithTracks.mockResolvedValue({
      id: 'p1',
      title: 'Без превью',
      description: null,
      coverUrl: null,
      visibility: 'PUBLIC',
      ownerUserId: null,
      likesCount: 0,
      tracks: [{ coverUrl: 'https://cdn.test/broken.jpg' }],
    });
    fetchCoverThumb.mockResolvedValueOnce(null);

    await PlaylistOgImage({ params });

    expect(tree()).not.toContain('cdn.test');
  });
});
