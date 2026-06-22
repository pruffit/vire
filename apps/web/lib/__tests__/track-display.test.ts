import { describe, it, expect } from 'vitest';
import { featuredNames, featLabel, displayTrackTitle } from '../track-display';
import type { TrackCredit } from '../upload';

const credits: TrackCredit[] = [
  { name: 'AVOCADICK', role: 'PERFORMER' },
  { name: 'Guest One', role: 'FEATURED' },
  { name: '  Guest Two ', role: 'FEATURED' },
  { name: '', role: 'FEATURED' },
  { name: 'Producer X', role: 'PRODUCER' },
];

describe('featuredNames', () => {
  it('returns trimmed FEATURED names, dropping empties', () => {
    expect(featuredNames(credits)).toEqual(['Guest One', 'Guest Two']);
  });
  it('returns empty when no feat', () => {
    expect(featuredNames([{ name: 'A', role: 'PERFORMER' }])).toEqual([]);
  });
});

describe('featLabel', () => {
  it('composes feat. list', () => {
    expect(featLabel(credits)).toBe('feat. Guest One, Guest Two');
  });
  it('is empty without feat', () => {
    expect(featLabel([])).toBe('');
  });
});

describe('displayTrackTitle', () => {
  it('appends feat and version', () => {
    expect(displayTrackTitle('Home', { version: 'Radio Edit', credits })).toBe(
      'Home (feat. Guest One, Guest Two) — Radio Edit',
    );
  });
  it('feat only', () => {
    expect(displayTrackTitle('Home', { credits })).toBe('Home (feat. Guest One, Guest Two)');
  });
  it('version only', () => {
    expect(displayTrackTitle('Home', { version: 'Slowed + Reverb' })).toBe('Home — Slowed + Reverb');
  });
  it('plain title', () => {
    expect(displayTrackTitle('Home')).toBe('Home');
    expect(displayTrackTitle('Home', { version: '   ', credits: [] })).toBe('Home');
  });
});
