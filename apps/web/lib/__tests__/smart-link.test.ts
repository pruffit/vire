import { describe, it, expect } from 'vitest';
import { normalizeSlug, isValidSlug, parseSmartLinkLinks } from '../smart-link';

describe('normalizeSlug', () => {
  it('приводит к латинице/цифрам/дефису', () => {
    expect(normalizeSlug('My New Release!')).toBe('my-new-release');
    expect(normalizeSlug('  spaces  ')).toBe('spaces');
    expect(normalizeSlug('a__b--c')).toBe('a-b-c');
  });
  it('режет ведущие/замыкающие дефисы', () => {
    expect(normalizeSlug('---hi---')).toBe('hi');
  });
  it('кириллица выпадает (нелатинские символы убираются)', () => {
    expect(normalizeSlug('Привет 2026')).toBe('2026');
  });
});

describe('isValidSlug', () => {
  it('принимает корректные', () => {
    expect(isValidSlug('moy-reliz')).toBe(true);
    expect(isValidSlug('album2')).toBe(true);
  });
  it('отвергает пустые/с пробелами/дефисами по краям', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('-x')).toBe(false);
    expect(isValidSlug('a b')).toBe(false);
    expect(isValidSlug('Upper')).toBe(false);
  });
});

describe('parseSmartLinkLinks', () => {
  it('оставляет только валидные http(s)-URL', () => {
    const raw = JSON.stringify([
      { url: 'https://open.spotify.com/x' },
      { url: 'ftp://nope' },
      { url: 'not a url' },
      { url: 'http://example.com', label: ' Сайт ' },
    ]);
    expect(parseSmartLinkLinks(raw)).toEqual([
      { url: 'https://open.spotify.com/x' },
      { url: 'http://example.com', label: 'Сайт' },
    ]);
  });

  it('не-строка / битый JSON / не массив → []', () => {
    expect(parseSmartLinkLinks(null)).toEqual([]);
    expect(parseSmartLinkLinks('{bad')).toEqual([]);
    expect(parseSmartLinkLinks('{"a":1}')).toEqual([]);
  });

  it('ограничивает количество', () => {
    const raw = JSON.stringify(
      Array.from({ length: 30 }, (_, i) => ({ url: `https://e${i}.com` })),
    );
    expect(parseSmartLinkLinks(raw, 20)).toHaveLength(20);
  });
});
