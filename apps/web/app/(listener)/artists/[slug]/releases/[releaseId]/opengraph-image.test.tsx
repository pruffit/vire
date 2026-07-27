import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getBySlug, getWithTracks, fetchCoverThumb, captured } = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  getWithTracks: vi.fn(),
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

vi.mock('@vire/db', () => ({ db: {}, DrizzleArtistRepository: class {}, DrizzleReleaseRepository: class {} }));

vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    ArtistService: class {
      getBySlug = getBySlug;
    },
    ReleaseService: class {
      getWithTracks = getWithTracks;
    },
  };
});

import ReleaseOgImage from './opengraph-image';

function tree(): string {
  return JSON.stringify(captured.element);
}

const params = Promise.resolve({ slug: 'danya', releaseId: 'r1' });
const artist = { ok: true, value: { id: 'a1', slug: 'danya', name: 'Даня' } };

beforeEach(() => {
  vi.clearAllMocks();
  fetchCoverThumb.mockImplementation(async (url: string | null) => (url ? `thumb:${url}` : null));
  captured.element = null;
});

describe('OG-картинка релиза', () => {
  it('релиз не найден — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({ ok: false });
    await ReleaseOgImage({ params });
    expect(tree()).toContain('Vire');
  });

  it('релиз другого артиста — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({
      ok: true,
      value: { release: { artistProfileId: 'other', title: 'Чужой релиз', status: 'PUBLISHED', releaseDate: null, coverUrl: null }, tracks: [] },
    });
    await ReleaseOgImage({ params });
    expect(tree()).not.toContain('Чужой релиз');
  });

  it('черновик/будущий SCHEDULED — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({
      ok: true,
      value: {
        release: { artistProfileId: 'a1', title: 'Скоро выйдет', status: 'SCHEDULED', releaseDate: new Date(Date.now() + 86400000), coverUrl: null },
        tracks: [],
      },
    });
    await ReleaseOgImage({ params });
    expect(tree()).not.toContain('Скоро выйдет');
  });

  it('опубликованный релиз — название, артист·год и уменьшенная обложка', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({
      ok: true,
      value: {
        release: {
          artistProfileId: 'a1',
          title: 'Вечерний драйв',
          status: 'PUBLISHED',
          releaseDate: new Date('2026-03-01'),
          coverUrl: 'https://cdn.test/cover.jpg',
        },
        tracks: [],
      },
    });

    await ReleaseOgImage({ params });

    const out = tree();
    expect(out).toContain('Вечерний драйв');
    expect(out).toContain('Даня · 2026');
    expect(out).toContain('thumb:https://cdn.test/cover.jpg');
  });
});
