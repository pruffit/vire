import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  countSitemapArtists,
  countSitemapReleases,
  countSitemapTracks,
  countSitemapSmartLinks,
  countSitemapPlaylists,
} = vi.hoisted(() => ({
  countSitemapArtists: vi.fn(),
  countSitemapReleases: vi.fn(),
  countSitemapTracks: vi.fn(),
  countSitemapSmartLinks: vi.fn(),
  countSitemapPlaylists: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  countSitemapArtists,
  countSitemapReleases,
  countSitemapTracks,
  countSitemapSmartLinks,
  countSitemapPlaylists,
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  countSitemapArtists.mockResolvedValue(0);
  countSitemapReleases.mockResolvedValue(0);
  countSitemapTracks.mockResolvedValue(0);
  countSitemapSmartLinks.mockResolvedValue(0);
  countSitemapPlaylists.mockResolvedValue(0);
});

describe('GET /sitemap.xml', () => {
  it('serves XML content type', async () => {
    const res = await GET();
    expect(res.headers.get('Content-Type')).toBe('application/xml');
  });

  it('always includes static.xml even with empty sections', async () => {
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('/sitemaps/static.xml</loc>');
    expect(xml).not.toContain('artists-');
  });

  it('lists one shard per section with exactly SITEMAP_PAGE_SIZE records', async () => {
    countSitemapArtists.mockResolvedValue(10_000);
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('/sitemaps/artists-0.xml</loc>');
    expect(xml).not.toContain('artists-1.xml');
  });

  it('lists two shards when a section exceeds SITEMAP_PAGE_SIZE', async () => {
    countSitemapTracks.mockResolvedValue(10_001);
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('/sitemaps/tracks-0.xml</loc>');
    expect(xml).toContain('/sitemaps/tracks-1.xml</loc>');
    expect(xml).not.toContain('tracks-2.xml');
  });

  it('degrades to static.xml only when a count query throws', async () => {
    countSitemapReleases.mockRejectedValue(new Error('db down'));
    const res = await GET();
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('/sitemaps/static.xml</loc>');
    expect(xml).not.toContain('artists-');
    expect(xml).not.toContain('releases-');
  });
});
