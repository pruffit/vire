import { describe, it, expect } from 'vitest';
import { getTranslator } from '@vire/i18n/translator';
import { releaseMetaDescription, trackMetaDescription } from '../meta-descriptions';

const t = await getTranslator('ru');

describe('releaseMetaDescription', () => {
  it('varies wording by release type', async () => {
    const single = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'SINGLE', locale: 'ru' });
    const ep = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'EP', locale: 'ru' });
    const album = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', locale: 'ru' });
    expect(single).not.toBe(ep);
    expect(ep).not.toBe(album);
    expect(single).not.toBe(album);
    expect(single.toLowerCase()).toContain(t('common.releaseType.SINGLE').toLowerCase());
    expect(ep.toLowerCase()).toContain('ep');
    expect(album.toLowerCase()).toContain(t('common.releaseType.ALBUM').toLowerCase());
  });

  it('includes the year when provided and omits it otherwise', async () => {
    const withYear = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', year: 2024, locale: 'ru' });
    const withoutYear = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', year: null, locale: 'ru' });
    expect(withYear).toContain('2024');
    expect(withYear).not.toBe(withoutYear);
  });

  it('includes the track count when provided and omits it otherwise', async () => {
    const withCount = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', trackCount: 8, locale: 'ru' });
    const withoutCount = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', type: 'ALBUM', trackCount: null, locale: 'ru' });
    expect(withCount).toContain('8');
    expect(withCount).not.toBe(withoutCount);
  });

  it('degrades gracefully with no type/year/trackCount', async () => {
    const result = await releaseMetaDescription({ title: 'Огни', artistName: 'Артист', locale: 'ru' });
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('null');
    expect(result).not.toMatch(/\(\s*\)/);
    expect(result).not.toMatch(/\s,/);
    expect(result).toContain('Огни');
    expect(result).toContain('Артист');
  });

  it('always ends with a call to action mentioning VireMusic', async () => {
    expect(await releaseMetaDescription({ title: 'A', artistName: 'B', locale: 'ru' })).toMatch(/VireMusic/);
  });

  it('never returns an empty string', async () => {
    expect((await releaseMetaDescription({ title: '', artistName: '', locale: 'ru' })).length).toBeGreaterThan(0);
  });

  it('renders an English description for the en locale', async () => {
    const result = await releaseMetaDescription({ title: 'Lights', artistName: 'Artist', type: 'ALBUM', year: 2024, locale: 'en' });
    expect(result).toMatch(/VireMusic/);
    expect(result.toLowerCase()).toContain('album');
  });
});

describe('trackMetaDescription', () => {
  it('includes the year when provided', async () => {
    const withYear = await trackMetaDescription({ trackTitle: 'Трек', releaseTitle: 'Релиз', artistName: 'Артист', year: 2022, locale: 'ru' });
    const withoutYear = await trackMetaDescription({ trackTitle: 'Трек', releaseTitle: 'Релиз', artistName: 'Артист', year: null, locale: 'ru' });
    expect(withYear).toContain('2022');
    expect(withYear).not.toBe(withoutYear);
  });

  it('degrades gracefully with no year', async () => {
    const result = await trackMetaDescription({ trackTitle: 'Трек', releaseTitle: 'Релиз', artistName: 'Артист', locale: 'ru' });
    expect(result).not.toContain('undefined');
    expect(result).not.toMatch(/\(\s*\)/);
    expect(result).not.toMatch(/\s,/);
  });

  it('always ends with a call to action mentioning VireMusic', async () => {
    expect(await trackMetaDescription({ trackTitle: 'T', releaseTitle: 'R', artistName: 'A', locale: 'ru' })).toMatch(/VireMusic/);
  });

  it('never returns an empty string', async () => {
    expect((await trackMetaDescription({ trackTitle: '', releaseTitle: '', artistName: '', locale: 'ru' })).length).toBeGreaterThan(0);
  });

  it('renders an English description for the en locale', async () => {
    const result = await trackMetaDescription({ trackTitle: 'Night', releaseTitle: 'Lights', artistName: 'Artist', year: 2022, locale: 'en' });
    expect(result).toMatch(/VireMusic/);
    expect(result).toContain('2022');
  });
});
