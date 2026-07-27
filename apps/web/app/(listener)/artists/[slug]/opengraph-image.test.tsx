import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getBySlug, getPublishedByArtist, artistHasPublishedTrackById, fetchCoverThumb, captured } = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  getPublishedByArtist: vi.fn().mockResolvedValue([]),
  artistHasPublishedTrackById: vi.fn(),
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
  db: {},
  DrizzleArtistRepository: class {},
  DrizzleReleaseRepository: class {},
  artistHasPublishedTrackById,
}));

vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    ArtistService: class {
      getBySlug = getBySlug;
    },
    ReleaseService: class {
      getPublishedByArtist = getPublishedByArtist;
    },
  };
});

import ArtistOgImage from './opengraph-image';

function tree(): string {
  return JSON.stringify(captured.element);
}

const params = Promise.resolve({ slug: 'danya' });

beforeEach(() => {
  vi.clearAllMocks();
  getPublishedByArtist.mockResolvedValue([]);
  fetchCoverThumb.mockImplementation(async (url: string | null) => (url ? `thumb:${url}` : null));
  captured.element = null;
});

describe('OG-картинка артиста', () => {
  it('несуществующий артист — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue({ ok: false });
    await ArtistOgImage({ params });
    const out = tree();
    expect(out).toContain('Vire');
    expect(artistHasPublishedTrackById).not.toHaveBeenCalled();
  });

  it('пустой артист (без опубликованных треков) — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue({ ok: true, value: { id: 'a1', name: 'Тишина', bio: null, avatarUrl: null } });
    artistHasPublishedTrackById.mockResolvedValue(false);
    await ArtistOgImage({ params });
    const out = tree();
    expect(out).not.toContain('Тишина');
    expect(getPublishedByArtist).not.toHaveBeenCalled();
  });

  it('видимый артист — название, bio и уменьшенный аватар', async () => {
    getBySlug.mockResolvedValue({
      ok: true,
      value: { id: 'a1', name: 'Даня', bio: 'Электроника из Москвы', avatarUrl: 'https://cdn.test/avatar.jpg' },
    });
    artistHasPublishedTrackById.mockResolvedValue(true);
    getPublishedByArtist.mockResolvedValue([{ coverUrl: 'https://cdn.test/release.jpg' }]);

    await ArtistOgImage({ params });

    const out = tree();
    expect(out).toContain('Даня');
    expect(out).toContain('Электроника из Москвы');
    expect(out).toContain('thumb:https://cdn.test/avatar.jpg');
  });

  it('без bio — подпись «Артист на Vire»', async () => {
    getBySlug.mockResolvedValue({ ok: true, value: { id: 'a1', name: 'Даня', bio: null, avatarUrl: null } });
    artistHasPublishedTrackById.mockResolvedValue(true);

    await ArtistOgImage({ params });

    expect(tree()).toContain('Артист на Vire');
  });
});
