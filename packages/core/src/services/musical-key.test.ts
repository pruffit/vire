import { describe, it, expect } from 'vitest';
import {
  normalizeKeyString,
  parseMusicalKey,
  keySpellings,
  neighborKeys,
  keyMatchSets,
} from './musical-key';

describe('normalizeKeyString', () => {
  it('lowercases, strips spaces/dashes, maps ♯/♭ to #/b', () => {
    expect(normalizeKeyString('A Min')).toBe('amin');
    expect(normalizeKeyString('a-moll')).toBe('amoll');
    expect(normalizeKeyString('F♯ min')).toBe('f#min');
    expect(normalizeKeyString('G♭')).toBe('gb');
    expect(normalizeKeyString('8A')).toBe('8a');
  });
});

describe('parseMusicalKey', () => {
  it.each([
    ['Am', { pitchClass: 9, mode: 'minor' }],
    ['A min', { pitchClass: 9, mode: 'minor' }],
    ['A minor', { pitchClass: 9, mode: 'minor' }],
    ['a-moll', { pitchClass: 9, mode: 'minor' }],
    ['8A', { pitchClass: 9, mode: 'minor' }],
    ['8a', { pitchClass: 9, mode: 'minor' }],
    ['C', { pitchClass: 0, mode: 'major' }],
    ['C major', { pitchClass: 0, mode: 'major' }],
    ['C dur', { pitchClass: 0, mode: 'major' }],
    ['8B', { pitchClass: 0, mode: 'major' }],
    ['F#m', { pitchClass: 6, mode: 'minor' }],
    ['Gbm', { pitchClass: 6, mode: 'minor' }],
    ['Gb', { pitchClass: 6, mode: 'major' }],
  ] as const)('parses %s', (raw, expected) => {
    expect(parseMusicalKey(raw)).toEqual(expected);
  });

  it.each(['x', '', 'zzzz', '13A', '0A'])('returns null for garbage %s', (raw) => {
    expect(parseMusicalKey(raw)).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseMusicalKey(null)).toBeNull();
    expect(parseMusicalKey(undefined)).toBeNull();
  });
});

describe('keySpellings', () => {
  it('A minor includes am/amin/aminor/a-moll(normalized)/camelot 8a', () => {
    const spellings = keySpellings({ pitchClass: 9, mode: 'minor' });
    expect(spellings).toEqual(
      expect.arrayContaining(['am', 'amin', 'aminor', 'amoll', '8a']),
    );
  });

  it('C major includes c/cmaj/cmajor/cdur/camelot 8b', () => {
    const spellings = keySpellings({ pitchClass: 0, mode: 'major' });
    expect(spellings).toEqual(
      expect.arrayContaining(['c', 'cmaj', 'cmajor', 'cdur', '8b']),
    );
  });

  it('F#/Gb minor includes both enharmonic spellings', () => {
    const spellings = keySpellings({ pitchClass: 6, mode: 'minor' });
    expect(spellings).toEqual(
      expect.arrayContaining(['f#m', 'gbm', 'f#min', 'gbmin', '11a']),
    );
  });
});

describe('neighborKeys', () => {
  it('A minor -> [C major (relative), E minor (+7), D minor (-7)]', () => {
    expect(neighborKeys({ pitchClass: 9, mode: 'minor' })).toEqual([
      { pitchClass: 0, mode: 'major' },
      { pitchClass: 4, mode: 'minor' },
      { pitchClass: 2, mode: 'minor' },
    ]);
  });

  it('C major -> [A minor (relative), G major (+7), F major (-7)]', () => {
    expect(neighborKeys({ pitchClass: 0, mode: 'major' })).toEqual([
      { pitchClass: 9, mode: 'minor' },
      { pitchClass: 7, mode: 'major' },
      { pitchClass: 5, mode: 'major' },
    ]);
  });
});

describe('keyMatchSets', () => {
  it('Am: exact contains am/aminor/8a; neighbor contains C-major and D/E-minor spellings', () => {
    const result = keyMatchSets('Am');
    expect(result).not.toBeNull();
    expect(result!.exact).toEqual(expect.arrayContaining(['am', 'aminor', '8a']));
    expect(result!.neighbor).toEqual(
      expect.arrayContaining(['c', 'cmajor', '8b', 'em', 'eminor', 'dm', 'dminor']),
    );
  });

  it('returns null for unparseable input', () => {
    expect(keyMatchSets('nonsense')).toBeNull();
    expect(keyMatchSets(null)).toBeNull();
  });
});
