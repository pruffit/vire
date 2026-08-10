export interface SitemapAlternate {
  hreflang: string;
  href: string;
}

export interface SitemapUrl {
  url: string;
  lastModified?: Date;
  changeFrequency?: string;
  priority?: number;
  alternates?: SitemapAlternate[];
}

export interface SitemapIndexEntry {
  url: string;
  lastModified?: Date;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

export function renderUrlSet(urls: SitemapUrl[]): string {
  const entries = urls
    .map((u) => {
      const parts = [`<loc>${escapeXml(u.url)}</loc>`];
      if (u.lastModified) parts.push(`<lastmod>${u.lastModified.toISOString()}</lastmod>`);
      if (u.changeFrequency) parts.push(`<changefreq>${u.changeFrequency}</changefreq>`);
      if (u.priority !== undefined) parts.push(`<priority>${u.priority}</priority>`);
      for (const a of u.alternates ?? []) {
        parts.push(`<xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>`);
      }
      return `<url>${parts.join('')}</url>`;
    })
    .join('');
  return `${XML_HEADER}<urlset xmlns="${NAMESPACE}" xmlns:xhtml="${XHTML_NAMESPACE}">${entries}</urlset>`;
}

export function renderSitemapIndex(entries: SitemapIndexEntry[]): string {
  const items = entries
    .map((e) => {
      const parts = [`<loc>${escapeXml(e.url)}</loc>`];
      if (e.lastModified) parts.push(`<lastmod>${e.lastModified.toISOString()}</lastmod>`);
      return `<sitemap>${parts.join('')}</sitemap>`;
    })
    .join('');
  return `${XML_HEADER}<sitemapindex xmlns="${NAMESPACE}">${items}</sitemapindex>`;
}
