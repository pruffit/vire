import { describe, it, expect } from 'vitest';
import { isUuid, parseAudioExt, parseCredits, parseTrackNumber } from '../upload';

describe('isUuid', () => {
  it('accepts a valid v4 uuid', () => {
    expect(isUuid('1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('1321eb20c9e64d95b4e77e6a08fc8cf9')).toBe(false);
  });
});

describe('parseAudioExt', () => {
  it('detects wav and flac case-insensitively', () => {
    expect(parseAudioExt('track.wav')).toBe('wav');
    expect(parseAudioExt('TRACK.WAV')).toBe('wav');
    expect(parseAudioExt('my song.flac')).toBe('flac');
    expect(parseAudioExt('A.FLAC')).toBe('flac');
  });
  it('rejects other formats', () => {
    expect(parseAudioExt('track.mp3')).toBeNull();
    expect(parseAudioExt('track.aiff')).toBeNull();
    expect(parseAudioExt('noext')).toBeNull();
  });
});

describe('parseTrackNumber', () => {
  it('accepts positive integers', () => {
    expect(parseTrackNumber('1')).toBe(1);
    expect(parseTrackNumber('12')).toBe(12);
  });
  it('rejects zero, negatives, non-numeric, non-strings', () => {
    expect(parseTrackNumber('0')).toBeNull();
    expect(parseTrackNumber('-3')).toBeNull();
    expect(parseTrackNumber('abc')).toBeNull();
    expect(parseTrackNumber(null)).toBeNull();
    expect(parseTrackNumber(5)).toBeNull();
  });
});

describe('parseCredits', () => {
  it('returns [] for non-strings and invalid json', () => {
    expect(parseCredits(null)).toEqual([]);
    expect(parseCredits(42)).toEqual([]);
    expect(parseCredits('{not json')).toEqual([]);
    expect(parseCredits('{"a":1}')).toEqual([]); // not an array
  });

  it('keeps only entries with a non-empty name and valid role', () => {
    const raw = JSON.stringify([
      { name: 'Danya', role: 'PERFORMER' },
      { name: '   ', role: 'PERFORMER' }, // blank name dropped
      { name: 'X', role: 'NOPE' }, // bad role dropped
      { name: 'Y', role: 'PRODUCER' },
      { role: 'COMPOSER' }, // missing name dropped
    ]);
    expect(parseCredits(raw)).toEqual([
      { name: 'Danya', role: 'PERFORMER' },
      { name: 'Y', role: 'PRODUCER' },
    ]);
  });

  it('caps the number of credits', () => {
    const raw = JSON.stringify(
      Array.from({ length: 30 }, (_, i) => ({ name: `n${i}`, role: 'PERFORMER' })),
    );
    expect(parseCredits(raw, 20)).toHaveLength(20);
  });
});
