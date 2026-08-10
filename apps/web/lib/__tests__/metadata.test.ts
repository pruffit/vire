import { describe, it, expect } from 'vitest';
import { localizedAlternates, pageMetadata } from '../metadata';

describe('localizedAlternates', () => {
  it('ru — canonical без префикса, обе локали и x-default в languages', () => {
    expect(localizedAlternates('ru', '/artists/nova')).toEqual({
      canonical: '/artists/nova',
      languages: {
        'x-default': '/artists/nova',
        ru: '/artists/nova',
        en: '/en/artists/nova',
      },
    });
  });

  it('en — canonical с префиксом, x-default остаётся на дефолтной локали', () => {
    const alt = localizedAlternates('en', '/artists/nova');
    expect(alt.canonical).toBe('/en/artists/nova');
    expect(alt.languages?.['x-default']).toBe('/artists/nova');
  });

  it('корень — /en без хвостового слэша', () => {
    expect(localizedAlternates('en', '/')).toEqual({
      canonical: '/en',
      languages: { 'x-default': '/', ru: '/', en: '/en' },
    });
  });
});

describe('pageMetadata', () => {
  it('og:url совпадает с canonical локали', () => {
    const meta = pageMetadata({ url: '/releases', title: 'Релизы', description: 'd', locale: 'en' });
    expect(meta.alternates?.canonical).toBe('/en/releases');
    expect(meta.openGraph?.url).toBe('/en/releases');
  });

  it('og:locale в формате OpenGraph', () => {
    expect(pageMetadata({ url: '/releases', title: 't', description: 'd', locale: 'ru' }).openGraph?.locale).toBe('ru_RU');
    expect(pageMetadata({ url: '/releases', title: 't', description: 'd', locale: 'en' }).openGraph?.locale).toBe('en_US');
  });

  it('images: null — ключ не проставляется, чтобы не затереть файловый opengraph-image', () => {
    const meta = pageMetadata({ url: '/x', title: 't', description: 'd', locale: 'ru', images: null });
    expect(meta.openGraph && 'images' in meta.openGraph).toBe(false);
  });
});
