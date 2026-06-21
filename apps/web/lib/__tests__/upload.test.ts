import { describe, it, expect } from 'vitest';
import { isUuid, parseAudioExt, parseCredits, parseTrackNumber, validateMagicBytes, sanitizeCredits } from '../upload';

/** Build a minimal RIFF/WAVE header (codec-agnostic — we no longer inspect the fmt chunk). */
function makeWav(): Uint8Array {
  const buf = new Uint8Array(12);
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  buf.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  return buf;
}

describe('isUuid', () => {
  it('accepts a valid v4 uuid', () => {
    expect(isUuid('1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('1321eb20c9e64d95b4e77e6a08fc8cf9')).toBe(false);
  });
  it('rejects a truncated uuid (битая ссылка из ТГ — last group 11 hex)', () => {
    // Реальный кейс: обрезанный URL релиза ронял Postgres-запрос 500-кой вместо 404.
    expect(isUuid('f442053f-e7c9-44a0-91ea-9181855a1a2')).toBe(false);
  });
});

describe('parseAudioExt', () => {
  it('detects wav, flac and mp3 case-insensitively', () => {
    expect(parseAudioExt('track.wav')).toBe('wav');
    expect(parseAudioExt('TRACK.WAV')).toBe('wav');
    expect(parseAudioExt('my song.flac')).toBe('flac');
    expect(parseAudioExt('A.FLAC')).toBe('flac');
    expect(parseAudioExt('track.mp3')).toBe('mp3');
    expect(parseAudioExt('LOUD.MP3')).toBe('mp3');
  });
  it('rejects other formats', () => {
    expect(parseAudioExt('track.aiff')).toBeNull();
    expect(parseAudioExt('track.ogg')).toBeNull();
    expect(parseAudioExt('noext')).toBeNull();
  });
});

describe('validateMagicBytes', () => {
  it('accepts a FLAC "fLaC" header', () => {
    expect(validateMagicBytes(new Uint8Array([0x66, 0x4c, 0x61, 0x43]), 'flac')).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0x00, 0x4c, 0x61, 0x43]), 'flac')).toBe(false);
  });
  it('accepts a RIFF/WAVE header', () => {
    const wav = makeWav();
    expect(validateMagicBytes(wav, 'wav')).toBe(true);
    expect(validateMagicBytes(new Uint8Array(12), 'wav')).toBe(false);
  });
  it('accepts mp3 via ID3 tag or MPEG frame sync', () => {
    expect(validateMagicBytes(new Uint8Array([0x49, 0x44, 0x33]), 'mp3')).toBe(true); // "ID3"
    expect(validateMagicBytes(new Uint8Array([0xff, 0xfb, 0x90]), 'mp3')).toBe(true); // frame sync
    expect(validateMagicBytes(new Uint8Array([0x00, 0x01, 0x02]), 'mp3')).toBe(false);
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

describe('sanitizeCredits', () => {
  it('returns [] for non-arrays', () => {
    expect(sanitizeCredits(null)).toEqual([]);
    expect(sanitizeCredits('x')).toEqual([]);
    expect(sanitizeCredits({ name: 'a', role: 'PERFORMER' })).toEqual([]);
  });

  it('keeps valid entries, trims names, drops blanks and bad roles', () => {
    expect(
      sanitizeCredits([
        { name: '  Danya ', role: 'PERFORMER' },
        { name: '   ', role: 'COMPOSER' },
        { name: 'X', role: 'NOPE' },
        { name: 'Y', role: 'PRODUCER' },
      ]),
    ).toEqual([
      { name: 'Danya', role: 'PERFORMER' },
      { name: 'Y', role: 'PRODUCER' },
    ]);
  });

  it('caps the count', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ name: `n${i}`, role: 'LYRICIST' }));
    expect(sanitizeCredits(many, 20)).toHaveLength(20);
  });
});
