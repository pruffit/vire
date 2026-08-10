import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  listSitemapArtists,
  listSitemapReleases,
  listSitemapTracks,
  listSitemapSmartLinks,
  listSitemapPlaylists,
} = vi.hoisted(() => ({
  listSitemapArtists: vi.fn(),
  listSitemapReleases: vi.fn(),
  listSitemapTracks: vi.fn(),
  listSitemapSmartLinks: vi.fn(),
  listSitemapPlaylists: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  listSitemapArtists,
  listSitemapReleases,
  listSitemapTracks,
  listSitemapSmartLinks,
  listSitemapPlaylists,
}));

import { GET } from './route';

const ctx = (shard: string) => ({ params: Promise.resolve({ shard }) });
const req = () => new Request('http://localhost/sitemaps/x');

beforeEach(() => {
  vi.clearAllMocks();
  listSitemapArtists.mockResolvedValue([]);
  listSitemapReleases.mockResolvedValue([]);
  listSitemapTracks.mockResolvedValue([]);
  listSitemapSmartLinks.mockResolvedValue([]);
  listSitemapPlaylists.mockResolvedValue([]);
});

describe('GET /sitemaps/[shard]', () => {
  it('404s on a garbage shard id', async () => {
    const res = await GET(req(), ctx('../secret.xml'));
    expect(res.status).toBe(404);
  });

  it('404s on an unknown section', async () => {
    const res = await GET(req(), ctx('unknown-0.xml'));
    expect(res.status).toBe(404);
  });

  it('renders the four static routes for static.xml, doubled for ru+en with hreflang alternates', async () => {
    const res = await GET(req(), ctx('static.xml'));
    const xml = await res.text();
    expect(xml).toContain('<changefreq>daily</changefreq>');
    expect(xml).toContain('<priority>1</priority>');
    expect(xml).toContain('/artists</loc>');
    expect(xml).toContain('/en/artists</loc>');
    expect(xml).toContain('/releases</loc>');
    expect(xml).toContain('/about</loc>');
    expect((xml.match(/<url>/g) ?? []).length).toBe(8);
    expect(xml).toContain('hreflang="x-default"');
  });

  it('renders an empty urlset for a page past the data', async () => {
    const res = await GET(req(), ctx('artists-3.xml'));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<urlset');
    expect(xml).not.toContain('<url>');
    expect(listSitemapArtists).toHaveBeenCalledWith(10_000, 30_000);
  });

  it('builds artist URLs for both locales with hreflang alternates', async () => {
    listSitemapArtists.mockResolvedValue([{ slug: 'nova' }]);
    const res = await GET(req(), ctx('artists-0.xml'));
    const xml = await res.text();
    expect(xml).toContain('<loc>http://localhost:3000/artists/nova</loc>');
    expect(xml).toContain('<loc>http://localhost:3000/en/artists/nova</loc>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.7</priority>');
    expect((xml.match(/<url>/g) ?? []).length).toBe(2);
  });

  it('builds release URLs with lastmod', async () => {
    listSitemapReleases.mockResolvedValue([
      { id: 'r1', artistSlug: 'nova', updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);
    const res = await GET(req(), ctx('releases-0.xml'));
    const xml = await res.text();
    expect(xml).toContain('/artists/nova/releases/r1</loc>');
    expect(xml).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<priority>0.6</priority>');
  });

  it('builds track URLs nested under the release', async () => {
    listSitemapTracks.mockResolvedValue([
      { id: 't1', releaseId: 'r1', artistSlug: 'nova', updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);
    const res = await GET(req(), ctx('tracks-0.xml'));
    const xml = await res.text();
    expect(xml).toContain('/artists/nova/releases/r1/tracks/t1</loc>');
    expect(xml).toContain('<priority>0.5</priority>');
  });

  it('builds smart link URLs', async () => {
    listSitemapSmartLinks.mockResolvedValue([{ slug: 'drop', artistSlug: 'nova' }]);
    const res = await GET(req(), ctx('smartlinks-0.xml'));
    const xml = await res.text();
    expect(xml).toContain('/smartlink/nova/drop</loc>');
  });

  it('builds playlist URLs', async () => {
    listSitemapPlaylists.mockResolvedValue([
      { id: 'p1', updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);
    const res = await GET(req(), ctx('playlists-0.xml'));
    const xml = await res.text();
    expect(xml).toContain('/playlists/p1</loc>');
  });

  it('degrades to an empty urlset when the DB throws', async () => {
    listSitemapArtists.mockRejectedValue(new Error('db down'));
    const res = await GET(req(), ctx('artists-0.xml'));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).not.toContain('<url>');
  });
});
