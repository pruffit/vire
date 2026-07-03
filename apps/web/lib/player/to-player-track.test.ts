import { describe, it, expect } from 'vitest';
import { toPlayerTrack, toPlayerTracks } from './to-player-track';

describe('toPlayerTrack', () => {
  it('нормализует null accentColor/isExplicit в undefined', () => {
    const result = toPlayerTrack({
      id: 't1',
      title: 'Title',
      artistName: 'Artist',
      coverUrl: null,
      accentColor: null,
      isExplicit: null,
    });

    expect(result.accentColor).toBeUndefined();
    expect(result.isExplicit).toBeUndefined();
    expect(result.coverUrl).toBeNull();
  });

  it('нормализует отсутствующий coverUrl в null', () => {
    const result = toPlayerTrack({ id: 't1', title: 'Title', artistName: 'Artist' });
    expect(result.coverUrl).toBeNull();
  });

  it('оставляет отсутствующие опциональные поля undefined', () => {
    const result = toPlayerTrack({ id: 't1', title: 'Title', artistName: 'Artist', coverUrl: null });
    expect(result.artistSlug).toBeUndefined();
    expect(result.releaseId).toBeUndefined();
    expect(result.accentColor).toBeUndefined();
    expect(result.isExplicit).toBeUndefined();
  });

  it('прокидывает заданные значения без изменений', () => {
    const result = toPlayerTrack({
      id: 't1',
      title: 'Title',
      artistName: 'Artist',
      coverUrl: 'https://cdn.example/cover.jpg',
      artistSlug: 'artist-slug',
      releaseId: 'release-1',
      accentColor: '#ff0000',
      isExplicit: true,
    });

    expect(result).toEqual({
      id: 't1',
      title: 'Title',
      artistName: 'Artist',
      coverUrl: 'https://cdn.example/cover.jpg',
      artistSlug: 'artist-slug',
      releaseId: 'release-1',
      accentColor: '#ff0000',
      isExplicit: true,
    });
  });
});

describe('toPlayerTracks', () => {
  it('маппит массив, сохраняя порядок', () => {
    const rows = [
      { id: 'a', title: 'A', artistName: 'X', coverUrl: null },
      { id: 'b', title: 'B', artistName: 'X', coverUrl: null, accentColor: null },
    ];
    const result = toPlayerTracks(rows);
    expect(result.map((t) => t.id)).toEqual(['a', 'b']);
    expect(result[1].accentColor).toBeUndefined();
  });

  it('возвращает пустой массив для пустого входа', () => {
    expect(toPlayerTracks([])).toEqual([]);
  });
});
