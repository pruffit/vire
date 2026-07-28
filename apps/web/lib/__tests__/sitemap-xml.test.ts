import { describe, expect, it } from 'vitest';
import { renderUrlSet, renderSitemapIndex } from '../sitemap-xml';

describe('renderUrlSet', () => {
  it('renders the XML declaration and urlset namespace', () => {
    const xml = renderUrlSet([{ url: 'https://vire.ru/artists' }]);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });

  it('renders lastModified as ISO', () => {
    const xml = renderUrlSet([{ url: 'https://vire.ru/x', lastModified: new Date('2026-01-02T03:04:05.000Z') }]);
    expect(xml).toContain('<lastmod>2026-01-02T03:04:05.000Z</lastmod>');
  });

  it('omits lastmod/changefreq/priority when absent', () => {
    const xml = renderUrlSet([{ url: 'https://vire.ru/x' }]);
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
  });

  it('renders changeFrequency and priority', () => {
    const xml = renderUrlSet([{ url: 'https://vire.ru/x', changeFrequency: 'weekly', priority: 0.6 }]);
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.6</priority>');
  });

  it('escapes & < > " \' in URLs', () => {
    const xml = renderUrlSet([{ url: `https://vire.ru/artists/a&b<c>d"e'f` }]);
    expect(xml).toContain('https://vire.ru/artists/a&amp;b&lt;c&gt;d&quot;e&apos;f');
    expect(xml).not.toContain('a&b<c>d"e\'f<');
  });

  it('renders an empty urlset for no urls', () => {
    const xml = renderUrlSet([]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  });

  it('renders multiple url entries in order', () => {
    const xml = renderUrlSet([{ url: 'https://vire.ru/a' }, { url: 'https://vire.ru/b' }]);
    const aIndex = xml.indexOf('https://vire.ru/a');
    const bIndex = xml.indexOf('https://vire.ru/b');
    expect(aIndex).toBeGreaterThan(-1);
    expect(bIndex).toBeGreaterThan(aIndex);
  });
});

describe('renderSitemapIndex', () => {
  it('renders the sitemapindex namespace', () => {
    const xml = renderSitemapIndex([{ url: 'https://vire.ru/sitemaps/static.xml' }]);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</sitemapindex>');
    expect(xml).toContain('<loc>https://vire.ru/sitemaps/static.xml</loc>');
  });

  it('renders lastModified as ISO when present', () => {
    const xml = renderSitemapIndex([
      { url: 'https://vire.ru/sitemaps/artists-0.xml', lastModified: new Date('2026-01-02T03:04:05.000Z') },
    ]);
    expect(xml).toContain('<lastmod>2026-01-02T03:04:05.000Z</lastmod>');
  });

  it('omits lastmod when absent', () => {
    const xml = renderSitemapIndex([{ url: 'https://vire.ru/sitemaps/static.xml' }]);
    expect(xml).not.toContain('<lastmod>');
  });

  it('escapes special characters in the URL', () => {
    const xml = renderSitemapIndex([{ url: `https://vire.ru/sitemaps/a&b.xml` }]);
    expect(xml).toContain('<loc>https://vire.ru/sitemaps/a&amp;b.xml</loc>');
  });
});
