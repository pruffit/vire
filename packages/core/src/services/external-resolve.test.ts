import { describe, it, expect } from 'vitest';
import { classifyInput, parseKnownUrl, parseOwnUrl, normalizeUrlKey, normalizeQueryKey, scoreCatalogMatch, matchesExpectedTrack, parseProviderTrackUrl } from './external-resolve';
import type { SearchTrack } from '../types/search';

describe('classifyInput', () => {
  it('classifies a plain URL', () => {
    expect(classifyInput('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'url', url: 'https://youtu.be/dQw4w9WgXcQ' });
  });

  it('extracts a URL embedded in a sentence, dropping surrounding text and trailing punctuation', () => {
    expect(classifyInput('слушай это https://youtu.be/dQw4w9WgXcQ, огонь!')).toEqual({
      kind: 'url',
      url: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });

  it('falls back to a cleaned query for plain text', () => {
    expect(classifyInput('  Кино   Группа крови  ')).toEqual({ kind: 'query', text: 'Кино Группа крови' });
  });

  it('strips emoji and quotes from a text query', () => {
    const result = classifyInput('🔥 "Кино" — Группа крови 🔥');
    expect(result).toEqual({ kind: 'query', text: 'Кино — Группа крови' });
  });

  it('empty input yields an empty query, not a crash', () => {
    expect(classifyInput('   ')).toEqual({ kind: 'query', text: '' });
  });
});

describe('parseKnownUrl — YouTube', () => {
  const cases: Array<[string, string]> = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=abc123', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ];

  it.each(cases)('%s -> %s', (url, id) => {
    expect(parseKnownUrl(url)).toEqual({ source: 'YOUTUBE', externalId: id });
  });

  it('a youtube.com URL with no recognizable video id is not a match', () => {
    expect(parseKnownUrl('https://www.youtube.com/results?search_query=x')).toBeNull();
  });
});

describe('parseKnownUrl — SoundCloud', () => {
  it('artist/track path is playable', () => {
    expect(parseKnownUrl('https://soundcloud.com/an-artist/a-track')).toEqual({ source: 'SOUNDCLOUD', externalId: 'an-artist/a-track' });
  });

  it('reserved top-level paths (you, discover, search) are not tracks', () => {
    expect(parseKnownUrl('https://soundcloud.com/you/likes')).toBeNull();
    expect(parseKnownUrl('https://soundcloud.com/search?q=x')).toBeNull();
  });

  it('a bare profile URL (single segment) is not a track', () => {
    expect(parseKnownUrl('https://soundcloud.com/an-artist')).toBeNull();
  });
});

describe('parseKnownUrl — known non-playable services need page meta', () => {
  const cases: Array<[string, string]> = [
    ['https://open.spotify.com/track/abc123', 'spotify'],
    ['https://spotify.link/abc123', 'spotify'],
    ['https://music.apple.com/us/album/x/123', 'apple-music'],
    ['https://music.yandex.ru/album/1/track/2', 'yandex-music'],
    ['https://vk.com/audio123_456', 'vk'],
    ['https://deezer.com/track/123', 'deezer'],
    ['https://someartist.bandcamp.com/track/a-song', 'bandcamp'],
  ];

  it.each(cases)('%s -> service %s', (url, service) => {
    expect(parseKnownUrl(url)).toEqual({ service, needsPageMeta: true });
  });
});

describe('parseKnownUrl — unrecognized', () => {
  it('an arbitrary host is null (falls through to generic page-meta cascade)', () => {
    expect(parseKnownUrl('https://example.com/whatever')).toBeNull();
  });

  it('non-http(s) protocols are rejected', () => {
    expect(parseKnownUrl('ftp://youtube.com/watch?v=x')).toBeNull();
  });

  it('malformed URLs do not throw', () => {
    expect(parseKnownUrl('not a url')).toBeNull();
  });
});

describe('parseProviderTrackUrl', () => {
  it('spotify: a plain track URL', () => {
    expect(parseProviderTrackUrl('https://open.spotify.com/track/abc123XYZ')).toEqual({ provider: 'spotify', id: 'abc123XYZ' });
  });

  it('spotify: a localized track URL (intl-ru prefix)', () => {
    expect(parseProviderTrackUrl('https://open.spotify.com/intl-ru/track/abc123XYZ')).toEqual({ provider: 'spotify', id: 'abc123XYZ' });
  });

  it('spotify: query noise (si param) does not affect the match', () => {
    expect(parseProviderTrackUrl('https://open.spotify.com/track/abc123XYZ?si=xyz')).toEqual({ provider: 'spotify', id: 'abc123XYZ' });
  });

  it('spotify: a playlist/album/artist URL is not a track', () => {
    expect(parseProviderTrackUrl('https://open.spotify.com/playlist/abc123')).toBeNull();
    expect(parseProviderTrackUrl('https://open.spotify.com/album/abc123')).toBeNull();
    expect(parseProviderTrackUrl('https://open.spotify.com/artist/abc123')).toBeNull();
  });

  it('apple-music: id from the ?i= query param on an album URL', () => {
    expect(parseProviderTrackUrl('https://music.apple.com/us/album/some-song/1234567890?i=987654321')).toEqual({
      provider: 'apple-music',
      id: '987654321',
    });
  });

  it('apple-music: id from a /song/{slug}/{id} path with locale', () => {
    expect(parseProviderTrackUrl('https://music.apple.com/us/song/some-song/987654321')).toEqual({
      provider: 'apple-music',
      id: '987654321',
    });
  });

  it('apple-music: an album URL with no ?i= is not a track', () => {
    expect(parseProviderTrackUrl('https://music.apple.com/us/album/some-album/1234567890')).toBeNull();
  });

  it('deezer: a plain track URL', () => {
    expect(parseProviderTrackUrl('https://www.deezer.com/track/123456789')).toEqual({ provider: 'deezer', id: '123456789' });
  });

  it('deezer: a language-prefixed track URL', () => {
    expect(parseProviderTrackUrl('https://www.deezer.com/ru/track/123456789')).toEqual({ provider: 'deezer', id: '123456789' });
  });

  it('deezer: bare deezer.com host (no www) also matches', () => {
    expect(parseProviderTrackUrl('https://deezer.com/track/123456789')).toEqual({ provider: 'deezer', id: '123456789' });
  });

  it('deezer: an album/playlist URL is not a track', () => {
    expect(parseProviderTrackUrl('https://www.deezer.com/album/123456789')).toBeNull();
  });

  it('unrelated hosts and malformed URLs return null', () => {
    expect(parseProviderTrackUrl('https://example.com/track/1')).toBeNull();
    expect(parseProviderTrackUrl('not a url')).toBeNull();
  });
});

describe('parseOwnUrl', () => {
  const siteHost = 'viremusic.ru';
  const trackId = '11111111-1111-1111-1111-111111111111';
  const releaseId = '22222222-2222-2222-2222-222222222222';

  it('recognizes our own track URL', () => {
    expect(parseOwnUrl(`https://viremusic.ru/artists/some-artist/releases/${releaseId}/tracks/${trackId}`, siteHost)).toEqual({ trackId });
  });

  it('recognizes with a www. prefix on either side', () => {
    expect(parseOwnUrl(`https://www.viremusic.ru/artists/x/releases/${releaseId}/tracks/${trackId}`, siteHost)).toEqual({ trackId });
  });

  it('a different host is not ours', () => {
    expect(parseOwnUrl(`https://evil.example/artists/x/releases/${releaseId}/tracks/${trackId}`, siteHost)).toBeNull();
  });

  it('a release-level (no track) own URL is not a direct match', () => {
    expect(parseOwnUrl(`https://viremusic.ru/artists/x/releases/${releaseId}`, siteHost)).toBeNull();
  });
});

describe('normalizeUrlKey', () => {
  it('the same video via youtu.be and /watch?v= normalizes to the same key', () => {
    expect(normalizeUrlKey('https://youtu.be/dQw4w9WgXcQ')).toBe(normalizeUrlKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
  });

  it('timestamp/utm/si query noise does not change the key', () => {
    const base = normalizeUrlKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(normalizeUrlKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&si=xyz&utm_source=x')).toBe(base);
  });

  it('different videos normalize to different keys', () => {
    expect(normalizeUrlKey('https://youtu.be/aaaaaaaaaaa')).not.toBe(normalizeUrlKey('https://youtu.be/bbbbbbbbbbb'));
  });

  it('an unknown host keeps a meaningful (non-tracking) query param', () => {
    expect(normalizeUrlKey('https://example.com/song?id=42')).toContain('id=42');
  });
});

describe('normalizeQueryKey', () => {
  it('is case- and diacritic-insensitive', () => {
    expect(normalizeQueryKey('Кино', 'Группа крови')).toBe(normalizeQueryKey('кино', 'группа крови'));
    expect(normalizeQueryKey('Beyonce', 'Halo')).toBe(normalizeQueryKey('Beyoncé', 'HALO'));
  });

  it('strips feat./ft. and prod. credits', () => {
    const withFeat = normalizeQueryKey('Artist', 'Song (feat. Someone Else)');
    const bare = normalizeQueryKey('Artist', 'Song');
    expect(withFeat).toBe(bare);

    const withProd = normalizeQueryKey('Artist', 'Song (prod. Beatmaker)');
    expect(withProd).toBe(bare);
  });

  it('a remix/version suffix is NOT stripped — remix must differ from the original', () => {
    const original = normalizeQueryKey('Artist', 'Song');
    const remix = normalizeQueryKey('Artist', 'Song (Remix)');
    expect(remix).not.toBe(original);
  });

  it('feat. stripping does not eat a trailing remix suffix in the same title', () => {
    const key = normalizeQueryKey('Artist', 'Song (feat. Guest) [Remix]');
    expect(key).toContain('remix');
    expect(key).not.toContain('guest');
  });

  it('punctuation and extra whitespace do not affect the key', () => {
    expect(normalizeQueryKey('Artist!!', "  Song's   Title  ")).toBe(normalizeQueryKey('Artist', "Song's Title"));
  });
});

describe('matchesExpectedTrack — целый альбом вместо трека', () => {
  it('«Full Album» не сходится с запросом одного трека', () => {
    expect(matchesExpectedTrack(
      { title: 'Yes Future!', artistName: 'The Toxic Avenger' },
      { title: 'The Toxic Avenger - Yes Future - Full Album', artistName: 'Enchanté Records' },
    )).toBe(false);
  });

  it('сам трек по-прежнему сходится', () => {
    expect(matchesExpectedTrack(
      { title: 'Yes Future!', artistName: 'The Toxic Avenger' },
      { title: 'The Toxic Avenger - Yes Future! (Official Video)', artistName: 'The Toxic Avenger' },
    )).toBe(true);
  });

  it('запрос альбома альбому не мешает', () => {
    expect(matchesExpectedTrack(
      { title: 'Yes Future Full Album', artistName: 'The Toxic Avenger' },
      { title: 'The Toxic Avenger - Yes Future - Full Album', artistName: 'Enchanté Records' },
    )).toBe(true);
  });
});

describe('scoreCatalogMatch', () => {
  const track = (overrides: Partial<SearchTrack>): SearchTrack => ({
    id: 't1', title: 'Группа крови', releaseId: 'r1', artistSlug: 'kino', artistName: 'Кино', coverUrl: null, version: null, feat: [],
    ...overrides,
  });

  it('an exact normalized match wins immediately', () => {
    const candidates = [track({ id: 't-other', title: 'Другое' }), track({ id: 't-match' })];
    const result = scoreCatalogMatch({ title: 'Группа крови', artistName: 'Кино' }, candidates);
    expect(result?.id).toBe('t-match');
  });

  it('a close-enough fuzzy match (extra words) still wins', () => {
    const candidates = [track({ id: 't-match' })];
    const result = scoreCatalogMatch({ title: 'Группа крови (Official Video)', artistName: 'Кино' }, candidates);
    expect(result?.id).toBe('t-match');
  });

  it('an unrelated title does not match', () => {
    const candidates = [track({ id: 't-match' })];
    const result = scoreCatalogMatch({ title: 'Bohemian Rhapsody', artistName: 'Queen' }, candidates);
    expect(result).toBeNull();
  });

  it('a remix hint does not match the original catalog track', () => {
    const candidates = [track({ id: 't-original' })];
    const result = scoreCatalogMatch({ title: 'Группа крови (Remix)', artistName: 'Кино' }, candidates);
    expect(result).toBeNull();
  });

  it('empty candidate list returns null, not a throw', () => {
    expect(scoreCatalogMatch({ title: 'x', artistName: 'y' }, [])).toBeNull();
  });
});

describe('matchesExpectedTrack', () => {
  const expected = { title: 'bad guy', artistName: 'Billie Eilish' };

  it('шумный заголовок ролика — всё ещё тот же трек', () => {
    expect(matchesExpectedTrack(expected, { title: 'Billie Eilish - bad guy (Official Music Video)', artistName: 'BillieEilishVEVO' })).toBe(true);
  });

  it('похожее название другого трека не проходит', () => {
    expect(
      matchesExpectedTrack({ title: 'Numbed In Moscow', artistName: 'Portishead' }, { title: 'Numb (Official Video)', artistName: 'PortisheadVEVO' }),
    ).toBe(false);
  });

  it('ремикс не выдаётся за оригинал', () => {
    expect(matchesExpectedTrack(expected, { title: 'Billie Eilish - bad guy (Remix)', artistName: 'BillieEilishVEVO' })).toBe(false);
  });

  it('оригинал не подставляется вместо запрошенного ремикса', () => {
    expect(matchesExpectedTrack({ title: 'bad guy (Remix)', artistName: 'Billie Eilish' }, { title: 'bad guy', artistName: 'Billie Eilish' })).toBe(false);
  });

  it('пустое ожидание совпадением не считается', () => {
    expect(matchesExpectedTrack({ title: '', artistName: '' }, { title: 'что угодно', artistName: 'кто угодно' })).toBe(false);
  });
});
