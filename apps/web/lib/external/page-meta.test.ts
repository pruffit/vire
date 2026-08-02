import { describe, it, expect, vi, beforeEach } from 'vitest';

const { safeFetchTextMock } = vi.hoisted(() => ({ safeFetchTextMock: vi.fn() }));
vi.mock('./safe-fetch', () => ({ safeFetchText: safeFetchTextMock }));

import { fetchPageMeta } from './page-meta';

const page = (body: string, contentType = 'text/html', finalUrl = 'https://example.com/song') => ({ body, contentType, finalUrl });

beforeEach(() => vi.clearAllMocks());

describe('fetchPageMeta', () => {
  it('returns null when the underlying fetch fails (SSRF-blocked, network error, etc.)', async () => {
    safeFetchTextMock.mockResolvedValue(null);
    expect(await fetchPageMeta('https://example.com/song')).toBeNull();
  });

  it('returns null for a non-html content-type', async () => {
    safeFetchTextMock.mockResolvedValue(page('{}', 'application/json'));
    expect(await fetchPageMeta('https://example.com/song')).toBeNull();
  });

  it('follows oEmbed discovery when the page advertises it', async () => {
    const html = `<html><head><link rel="alternate" type="application/json+oembed" href="https://example.com/oembed?url=x"></head></html>`;
    safeFetchTextMock.mockResolvedValueOnce(page(html)).mockResolvedValueOnce(page(JSON.stringify({ title: 'Discovered Song', author_name: 'Discovered Artist', thumbnail_url: 'https://img' }), 'application/json'));

    const result = await fetchPageMeta('https://example.com/song');

    expect(result).toEqual({ title: 'Discovered Song', artistName: 'Discovered Artist', coverUrl: 'https://img', durationSec: null });
    expect(safeFetchTextMock).toHaveBeenCalledTimes(2);
    expect(safeFetchTextMock.mock.calls[1][0]).toBe('https://example.com/oembed?url=x');
  });

  it('falls back to og: tags when there is no oEmbed discovery link', async () => {
    const html = `
      <html><head>
        <meta property="og:title" content="OG Title" />
        <meta property="og:site_name" content="OG Site" />
        <meta property="og:image" content="/cover.jpg" />
      </head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html, 'text/html', 'https://example.com/song'));

    const result = await fetchPageMeta('https://example.com/song');

    // og:site_name — имя сайта, а не исполнитель: раньше артистом становилось «Spotify».
    expect(result).toEqual({ title: 'OG Title', artistName: null, coverUrl: 'https://example.com/cover.jpg', durationSec: null });
  });

  it('страница трека стриминга: исполнитель — первый сегмент описания, а не имя сайта', async () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Каждый раз" />
        <meta property="og:type" content="music.song" />
        <meta property="og:site_name" content="Spotify" />
        <meta property="og:description" content="Monetochka &#183; Раскраски для взрослых &#183; Song &#183; 2018" />
      </head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html));

    const result = await fetchPageMeta('https://open.spotify.com/track/x');

    expect(result?.title).toBe('Каждый раз');
    expect(result?.artistName).toBe('Monetochka');
  });

  it('описание берётся и из twitter:description, если og:description нет', async () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Song" />
        <meta property="og:type" content="music.song" />
        <meta name="twitter:description" content="Artist · Album · Song · 2020" />
      </head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html));

    expect((await fetchPageMeta('https://example.com/song'))?.artistName).toBe('Artist');
  });

  it('не музыкальная страница: первый сегмент описания исполнителем не считается', async () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Статья" />
        <meta property="og:type" content="article" />
        <meta property="og:description" content="Раздел · Подраздел · Текст" />
      </head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html));

    expect((await fetchPageMeta('https://example.com/post'))?.artistName).toBeNull();
  });

  it('описание без разделителя исполнителем не считается — целиком оно не имя', async () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Song" />
        <meta property="og:type" content="music.song" />
        <meta property="og:description" content="Слушайте этот трек на нашем сервисе прямо сейчас" />
      </head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html));

    expect((await fetchPageMeta('https://example.com/song'))?.artistName).toBeNull();
  });

  it('JSON-LD byArtist важнее описания', async () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Song" />
        <meta property="og:type" content="music.song" />
        <meta property="og:description" content="Из описания · Альбом · Song" />
        <script type="application/ld+json">${JSON.stringify({ '@type': 'MusicRecording', name: 'Song', byArtist: { name: 'Из JSON-LD' } })}</script>
      </head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html));

    expect((await fetchPageMeta('https://example.com/song'))?.artistName).toBe('Из JSON-LD');
  });

  it('falls back to twitter: tags when og: tags are absent', async () => {
    const html = `<html><head><meta name="twitter:title" content="Twitter Title" /><meta name="twitter:image" content="https://img/tw.jpg" /></head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html));

    const result = await fetchPageMeta('https://example.com/song');

    expect(result).toEqual({ title: 'Twitter Title', artistName: null, coverUrl: 'https://img/tw.jpg', durationSec: null });
  });

  it('falls back to JSON-LD MusicRecording when no meta tags are present', async () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'MusicRecording', name: 'LD Song', byArtist: { name: 'LD Artist' }, duration: 'PT3M45S' })}</script></head></html>`;
    safeFetchTextMock.mockResolvedValue(page(html));

    const result = await fetchPageMeta('https://example.com/song');

    expect(result).toEqual({ title: 'LD Song', artistName: 'LD Artist', coverUrl: null, durationSec: 225 });
  });

  it('decodes HTML entities in extracted text', async () => {
    const html = `<meta property="og:title" content="Rock &amp; Roll" />`;
    safeFetchTextMock.mockResolvedValue(page(html));

    const result = await fetchPageMeta('https://example.com/song');
    expect(result?.title).toBe('Rock & Roll');
  });

  it('a page with no extractable title at all returns null, not throws', async () => {
    safeFetchTextMock.mockResolvedValue(page('<html><body>nothing here</body></html>'));
    expect(await fetchPageMeta('https://example.com/song')).toBeNull();
  });

  it('malformed JSON-LD does not crash the extraction', async () => {
    const html = `<script type="application/ld+json">{not valid json</script><meta property="og:title" content="Fallback Title" />`;
    safeFetchTextMock.mockResolvedValue(page(html));

    const result = await fetchPageMeta('https://example.com/song');
    expect(result?.title).toBe('Fallback Title');
  });
});
