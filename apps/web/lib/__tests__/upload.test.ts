import { describe, it, expect } from 'vitest';
import { isUuid, parseAudioExt, parseCredits, parseTrackNumber, validateMagicBytes, parseWavFormat } from '../upload';

/** Build a minimal RIFF/WAVE buffer with one `fmt ` chunk. */
function makeWav({
  audioFormat = 1,
  sampleRate = 44100,
  bitsPerSample = 16,
  subFormatTag,
  leadingJunk = false,
}: {
  audioFormat?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  subFormatTag?: number; // when set → EXTENSIBLE (40-byte fmt)
  leadingJunk?: boolean;
} = {}): Uint8Array {
  const fmtSize = subFormatTag !== undefined ? 40 : 16;
  const junkSize = leadingJunk ? 8 : 0;
  const buf = new Uint8Array(12 + junkSize + 8 + fmtSize);
  const view = new DataView(buf.buffer);
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  buf.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  let off = 12;
  if (leadingJunk) {
    buf.set([0x4a, 0x55, 0x4e, 0x4b], off); // "JUNK"
    view.setUint32(off + 4, 0, true);
    off += 8;
  }
  buf.set([0x66, 0x6d, 0x74, 0x20], off); // "fmt "
  view.setUint32(off + 4, fmtSize, true);
  const d = off + 8;
  view.setUint16(d, audioFormat, true);
  view.setUint16(d + 2, 2, true); // channels
  view.setUint32(d + 4, sampleRate, true);
  view.setUint16(d + 14, bitsPerSample, true);
  if (subFormatTag !== undefined) view.setUint16(d + 24, subFormatTag, true);
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

describe('parseWavFormat', () => {
  it('reads PCM 44.1k/16-bit', () => {
    expect(parseWavFormat(makeWav())).toEqual({ isPcm: true, sampleRate: 44100, bitsPerSample: 16 });
  });
  it('reads PCM 48k/24-bit (allowed — rate/depth not restricted)', () => {
    expect(parseWavFormat(makeWav({ sampleRate: 48000, bitsPerSample: 24 })))
      .toEqual({ isPcm: true, sampleRate: 48000, bitsPerSample: 24 });
  });
  it('flags IEEE float (audioFormat 3) as non-PCM', () => {
    expect(parseWavFormat(makeWav({ audioFormat: 3 }))?.isPcm).toBe(false);
  });
  it('treats EXTENSIBLE with a PCM SubFormat as PCM', () => {
    expect(parseWavFormat(makeWav({ audioFormat: 0xfffe, subFormatTag: 1, bitsPerSample: 24 }))?.isPcm).toBe(true);
  });
  it('treats EXTENSIBLE with a non-PCM SubFormat as non-PCM', () => {
    expect(parseWavFormat(makeWav({ audioFormat: 0xfffe, subFormatTag: 3 }))?.isPcm).toBe(false);
  });
  it('finds the fmt chunk past a leading JUNK chunk', () => {
    expect(parseWavFormat(makeWav({ leadingJunk: true }))?.isPcm).toBe(true);
  });
  it('returns null for a non-WAV buffer', () => {
    expect(parseWavFormat(new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
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
