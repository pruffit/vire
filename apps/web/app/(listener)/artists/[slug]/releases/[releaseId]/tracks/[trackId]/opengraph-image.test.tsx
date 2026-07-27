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

import TrackOgImage from './opengraph-image';

function tree(): string {
  return JSON.stringify(captured.element);
}

const params = Promise.resolve({ slug: 'danya', releaseId: 'r1', trackId: 't1' });
const artist = { ok: true, value: { id: 'a1', slug: 'danya', name: 'Даня' } };
const release = { artistProfileId: 'a1', title: 'Вечерний драйв', status: 'PUBLISHED', releaseDate: null, coverUrl: 'https://cdn.test/cover.jpg' };

beforeEach(() => {
  vi.clearAllMocks();
  fetchCoverThumb.mockImplementation(async (url: string | null) => (url ? `thumb:${url}` : null));
  captured.element = null;
});

describe('OG-картинка трека', () => {
  it('релиз не найден — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({ ok: false });
    await TrackOgImage({ params });
    expect(tree()).toContain('Vire');
  });

  it('трек неопубликованного релиза — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({
      ok: true,
      value: { release: { ...release, status: 'DRAFT' }, tracks: [{ id: 't1', title: 'Ночной город', version: null, credits: [] }] },
    });
    await TrackOgImage({ params });
    expect(tree()).not.toContain('Ночной город');
  });

  it('трек не найден в релизе — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({ ok: true, value: { release, tracks: [] } });
    await TrackOgImage({ params });
    expect(tree()).toContain('Vire');
  });

  it('видимый трек — заголовок, «релиз · артист» и уменьшенная обложка', async () => {
    getBySlug.mockResolvedValue(artist);
    getWithTracks.mockResolvedValue({
      ok: true,
      value: { release, tracks: [{ id: 't1', title: 'Ночной город', version: null, credits: [] }] },
    });

    await TrackOgImage({ params });

    const out = tree();
    expect(out).toContain('Ночной город');
    expect(out).toContain('Вечерний драйв · Даня');
    expect(out).toContain('thumb:https://cdn.test/cover.jpg');
  });
});
