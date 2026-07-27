import { describe, it, expect } from 'vitest';
import { releaseMetaDescription, trackMetaDescription } from '../meta-descriptions';

describe('releaseMetaDescription', () => {
  it('varies wording by release type', () => {
    const single = releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'SINGLE' });
    const ep = releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'EP' });
    const album = releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM' });
    expect(single).not.toBe(ep);
    expect(ep).not.toBe(album);
    expect(single).not.toBe(album);
    expect(single.toLowerCase()).toContain('сингл');
    expect(ep.toLowerCase()).toContain('ep');
    expect(album.toLowerCase()).toContain('альбом');
  });

  it('includes the year when provided and omits it otherwise', () => {
    const withYear = releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', year: 2024 });
    const withoutYear = releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', year: null });
    expect(withYear).toContain('2024');
    expect(withYear).not.toBe(withoutYear);
  });

  it('includes the track count when provided and omits it otherwise', () => {
    const withCount = releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', trackCount: 8 });
    const withoutCount = releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', trackCount: null });
    expect(withCount).toContain('8');
    expect(withCount).not.toBe(withoutCount);
  });

  it('degrades gracefully with no type/year/trackCount', () => {
    const result = releaseMetaDescription({ title: 'Огни', artistName: 'Артист' });
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('null');
    expect(result).not.toMatch(/\(\s*\)/);
    expect(result).not.toMatch(/\s,/);
    expect(result).toContain('Огни');
    expect(result).toContain('Артист');
  });

  it('always ends with a call to action mentioning VireMusic', () => {
    expect(releaseMetaDescription({ title: 'A', artistName: 'B' })).toMatch(/VireMusic/);
  });

  it('never returns an empty string', () => {
    expect(releaseMetaDescription({ title: '', artistName: '' }).length).toBeGreaterThan(0);
  });
});

describe('trackMetaDescription', () => {
  it('includes the year when provided', () => {
    const withYear = trackMetaDescription({ trackTitle: 'Трек', releaseTitle: 'Релиз', artistName: 'Артист', year: 2022 });
    const withoutYear = trackMetaDescription({ trackTitle: 'Трек', releaseTitle: 'Релиз', artistName: 'Артист', year: null });
    expect(withYear).toContain('2022');
    expect(withYear).not.toBe(withoutYear);
  });

  it('degrades gracefully with no year', () => {
    const result = trackMetaDescription({ trackTitle: 'Трек', releaseTitle: 'Релиз', artistName: 'Артист' });
    expect(result).not.toContain('undefined');
    expect(result).not.toMatch(/\(\s*\)/);
    expect(result).not.toMatch(/\s,/);
  });

  it('always ends with a call to action mentioning VireMusic', () => {
    expect(trackMetaDescription({ trackTitle: 'T', releaseTitle: 'R', artistName: 'A' })).toMatch(/VireMusic/);
  });

  it('never returns an empty string', () => {
    expect(trackMetaDescription({ trackTitle: '', releaseTitle: '', artistName: '' }).length).toBeGreaterThan(0);
  });
});
