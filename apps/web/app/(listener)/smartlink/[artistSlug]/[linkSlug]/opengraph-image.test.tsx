import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getBySlug, getSmartLinkBySlug, getSmartLinkRelease, fetchCoverThumb, captured } = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  getSmartLinkBySlug: vi.fn(),
  getSmartLinkRelease: vi.fn(),
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

vi.mock('@vire/db', () => ({ db: {}, DrizzleArtistRepository: class {}, getSmartLinkBySlug, getSmartLinkRelease }));

vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    ArtistService: class {
      getBySlug = getBySlug;
    },
  };
});

import SmartLinkOgImage from './opengraph-image';

function tree(): string {
  return JSON.stringify(captured.element);
}

const params = Promise.resolve({ artistSlug: 'danya', linkSlug: 'novy-trek' });
const artist = { ok: true, value: { id: 'a1', slug: 'danya', name: 'Даня' } };

beforeEach(() => {
  vi.clearAllMocks();
  fetchCoverThumb.mockImplementation(async (url: string | null) => (url ? `thumb:${url}` : null));
  getSmartLinkRelease.mockResolvedValue(null);
  captured.element = null;
});

describe('OG-картинка смартлинка', () => {
  it('артист не найден — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue({ ok: false });
    await SmartLinkOgImage({ params });
    expect(tree()).toContain('Vire');
    expect(getSmartLinkBySlug).not.toHaveBeenCalled();
  });

  it('лендинг не найден — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getSmartLinkBySlug.mockResolvedValue(null);
    await SmartLinkOgImage({ params });
    expect(tree()).toContain('Vire');
  });

  it('черновик (не опубликован) — фолбэк без данных', async () => {
    getBySlug.mockResolvedValue(artist);
    getSmartLinkBySlug.mockResolvedValue({
      title: 'Скрытый лендинг', subtitle: null, coverUrl: null, releaseId: null, isPublished: false, links: [],
    });
    await SmartLinkOgImage({ params });
    expect(tree()).not.toContain('Скрытый лендинг');
  });

  it('опубликованный лендинг — название, подпись и уменьшенная обложка', async () => {
    getBySlug.mockResolvedValue(artist);
    getSmartLinkBySlug.mockResolvedValue({
      title: 'Новый трек',
      subtitle: 'Слушай везде',
      coverUrl: 'https://cdn.test/cover.jpg',
      releaseId: null,
      isPublished: true,
      links: [],
    });

    await SmartLinkOgImage({ params });

    const out = tree();
    expect(out).toContain('Новый трек');
    expect(out).toContain('Слушай везде');
    expect(out).toContain('thumb:https://cdn.test/cover.jpg');
  });

  it('пустые поля лендинга дополняются привязанным релизом', async () => {
    getBySlug.mockResolvedValue(artist);
    getSmartLinkBySlug.mockResolvedValue({
      title: '', subtitle: null, coverUrl: null, releaseId: 'r1', isPublished: true, links: [],
    });
    getSmartLinkRelease.mockResolvedValue({ id: 'r1', title: 'Название из релиза', coverUrl: 'https://cdn.test/rel.jpg', releaseDate: null, status: 'PUBLISHED' });

    await SmartLinkOgImage({ params });

    const out = tree();
    expect(out).toContain('Название из релиза');
    expect(out).toContain('thumb:https://cdn.test/rel.jpg');
  });
});
