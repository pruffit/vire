import { describe, it, expect } from 'vitest';
import {
  secondsToISO8601,
  musicGroupJsonLd,
  musicAlbumJsonLd,
  musicRecordingJsonLd,
  breadcrumbListJsonLd,
  artistsCatalogJsonLd,
} from '../structured-data';

// SITE_URL по умолчанию (без env) = http://localhost:3000
const BASE = 'http://localhost:3000';

describe('secondsToISO8601', () => {
  it('returns undefined for null/zero/negative/NaN', () => {
    expect(secondsToISO8601(null)).toBeUndefined();
    expect(secondsToISO8601(undefined)).toBeUndefined();
    expect(secondsToISO8601(0)).toBeUndefined();
    expect(secondsToISO8601(-5)).toBeUndefined();
    expect(secondsToISO8601(NaN)).toBeUndefined();
  });

  it('formats minutes and seconds', () => {
    expect(secondsToISO8601(201)).toBe('PT3M21S');
    expect(secondsToISO8601(59)).toBe('PT59S');
    expect(secondsToISO8601(60)).toBe('PT1M');
  });

  it('includes hours when present', () => {
    expect(secondsToISO8601(3661)).toBe('PT1H1M1S');
    expect(secondsToISO8601(7200)).toBe('PT2H');
  });

  it('rounds fractional seconds', () => {
    expect(secondsToISO8601(200.6)).toBe('PT3M21S');
  });
});

describe('musicGroupJsonLd', () => {
  it('builds a MusicGroup with absolute urls and social sameAs', () => {
    const ld = musicGroupJsonLd({
      name: 'Kotlaev',
      slug: 'kotlaev',
      avatarUrl: 'https://cdn.example/a.jpg',
      bio: 'тест',
      links: [
        { label: 'VK', url: 'https://vk.com/kotlaev' },
        { label: 'tg', url: 'not-a-url' },
      ],
    });
    expect(ld['@type']).toBe('MusicGroup');
    expect(ld.url).toBe(`${BASE}/artists/kotlaev`);
    expect(ld.image).toBe('https://cdn.example/a.jpg');
    expect(ld.description).toBe('тест');
    // только валидные http(s) ссылки попадают в sameAs
    expect(ld.sameAs).toEqual(['https://vk.com/kotlaev']);
  });

  it('omits empty optional fields', () => {
    const ld = musicGroupJsonLd({ name: 'X', slug: 'x' });
    expect(ld).not.toHaveProperty('image');
    expect(ld).not.toHaveProperty('description');
    expect(ld).not.toHaveProperty('sameAs');
  });
});

describe('musicAlbumJsonLd', () => {
  it('builds a MusicAlbum with byArtist and ordered tracks', () => {
    const ld = musicAlbumJsonLd(
      { id: 'rel1', title: 'Альбом', coverUrl: 'https://cdn/x.jpg', releaseDate: '2025-03-15' },
      { name: 'Kotlaev', slug: 'kotlaev' },
      [
        { id: 't1', title: 'Один', trackNumber: 1, durationSec: 201 },
        { id: 't2', title: 'Два', trackNumber: 2, durationSec: null },
      ],
    );
    expect(ld['@type']).toBe('MusicAlbum');
    expect(ld.url).toBe(`${BASE}/artists/kotlaev/releases/rel1`);
    expect(ld.numTracks).toBe(2);
    expect(ld.datePublished).toBe('2025-03-15');
    expect((ld.byArtist as Record<string, unknown>).url).toBe(`${BASE}/artists/kotlaev`);

    const tracks = ld.track as Record<string, unknown>[];
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      '@type': 'MusicRecording',
      position: 1,
      name: 'Один',
      url: `${BASE}/artists/kotlaev/releases/rel1/tracks/t1`,
      duration: 'PT3M21S',
    });
    // трек без длительности не содержит duration
    expect(tracks[1]).not.toHaveProperty('duration');
  });

  it('omits track array and numTracks when empty', () => {
    const ld = musicAlbumJsonLd(
      { id: 'r', title: 'T' },
      { name: 'A', slug: 'a' },
      [],
    );
    expect(ld).not.toHaveProperty('track');
    expect(ld).not.toHaveProperty('numTracks');
  });
});

describe('breadcrumbListJsonLd', () => {
  it('builds a BreadcrumbList with absolute urls and 1-based positions', () => {
    const ld = breadcrumbListJsonLd([
      { name: 'Главная', url: '/' },
      { name: 'Артисты', url: '/artists' },
      { name: 'Kotlaev', url: '/artists/kotlaev' },
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    const items = ld.itemListElement as Record<string, unknown>[];
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ '@type': 'ListItem', position: 1, name: 'Главная', item: `${BASE}/` });
    expect(items[1]).toMatchObject({ position: 2, name: 'Артисты', item: `${BASE}/artists` });
    expect(items[2]).toMatchObject({ position: 3, name: 'Kotlaev', item: `${BASE}/artists/kotlaev` });
  });

  it('passes through absolute urls unchanged', () => {
    const ld = breadcrumbListJsonLd([{ name: 'X', url: 'https://other.com/page' }]);
    const items = ld.itemListElement as Record<string, unknown>[];
    expect(items[0].item).toBe('https://other.com/page');
  });
});

describe('artistsCatalogJsonLd', () => {
  it('builds a CollectionPage for the artists catalog', () => {
    const ld = artistsCatalogJsonLd();
    expect(ld['@type']).toBe('CollectionPage');
    expect(ld.url).toBe(`${BASE}/artists`);
    expect(ld.name).toBe('Артисты — Vire');
  });
});

describe('musicRecordingJsonLd', () => {
  it('builds a MusicRecording with inAlbum and byArtist', () => {
    const ld = musicRecordingJsonLd(
      { id: 't1', title: 'Трек', trackNumber: 3, durationSec: 185 },
      { id: 'rel1', title: 'Альбом', coverUrl: 'https://cdn/c.jpg' },
      { name: 'Kotlaev', slug: 'kotlaev' },
    );
    expect(ld['@type']).toBe('MusicRecording');
    expect(ld.url).toBe(`${BASE}/artists/kotlaev/releases/rel1/tracks/t1`);
    expect(ld.duration).toBe('PT3M5S');
    expect(ld.image).toBe('https://cdn/c.jpg');
    expect((ld.inAlbum as Record<string, unknown>).url).toBe(`${BASE}/artists/kotlaev/releases/rel1`);
    expect((ld.byArtist as Record<string, unknown>).name).toBe('Kotlaev');
  });
});
