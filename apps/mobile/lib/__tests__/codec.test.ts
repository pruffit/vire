import { describe, expect, it } from 'vitest';
import { toB64, fromB64, utf8, fromUtf8 } from '../codec';

describe('lib/codec', () => {
  it('round-trips arbitrary bytes through base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 127, 128]);
    expect(fromB64(toB64(bytes))).toEqual(bytes);
  });

  it('matches known standard-base64 vectors (RFC 4648 §10, with padding)', () => {
    expect(toB64(utf8(''))).toBe('');
    expect(toB64(utf8('f'))).toBe('Zg==');
    expect(toB64(utf8('fo'))).toBe('Zm8=');
    expect(toB64(utf8('foo'))).toBe('Zm9v');
    expect(toB64(utf8('foob'))).toBe('Zm9vYg==');
    expect(toB64(utf8('fooba'))).toBe('Zm9vYmE=');
    expect(toB64(utf8('foobar'))).toBe('Zm9vYmFy');
  });

  it('round-trips UTF-8 text, including cyrillic', () => {
    expect(fromUtf8(utf8('привет'))).toBe('привет');
  });
});
