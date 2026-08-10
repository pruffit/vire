import { describe, it, expect } from 'vitest';
import { generateJamCode, normalizeJamCode, JAM_CODE_ALPHABET, JAM_CODE_LENGTH } from './jam-code';

describe('JAM_CODE_ALPHABET', () => {
  it('is exactly the 32-char alphabet without lookalike glyphs', () => {
    expect(JAM_CODE_ALPHABET).toBe('23456789ABCDEFGHJKLMNPQRSTUVWXYZ');
    expect(JAM_CODE_ALPHABET.length).toBe(32);
  });

  it.each(['0', 'O', '1', 'I'])('excludes lookalike glyph %s', (char) => {
    expect(JAM_CODE_ALPHABET.includes(char)).toBe(false);
  });

  it('keeps L (not excluded — only 0/O and 1/I are confusable pairs here)', () => {
    expect(JAM_CODE_ALPHABET.includes('L')).toBe(true);
  });
});

describe('generateJamCode', () => {
  it('deterministic random produces deterministic code', () => {
    const random = () => 0.5;
    expect(generateJamCode(random)).toBe(generateJamCode(random));
  });

  it('always returns JAM_CODE_LENGTH characters', () => {
    expect(generateJamCode(() => 0.5)).toHaveLength(JAM_CODE_LENGTH);
  });

  it('random() returning 0 stays in bounds (first letter of alphabet)', () => {
    const code = generateJamCode(() => 0);
    expect(code).toBe(JAM_CODE_ALPHABET[0]!.repeat(JAM_CODE_LENGTH));
  });

  it('random() returning exactly 1 clamps to last letter, no undefined', () => {
    const code = generateJamCode(() => 1);
    expect(code).toBe(JAM_CODE_ALPHABET.at(-1)!.repeat(JAM_CODE_LENGTH));
    expect(code).not.toContain('undefined');
  });

  it('random() returning value close to 1 stays in bounds', () => {
    const code = generateJamCode(() => 0.9999999999);
    expect(code).not.toContain('undefined');
    expect(code).toHaveLength(JAM_CODE_LENGTH);
  });

  it('every character produced belongs to the alphabet', () => {
    const code = generateJamCode(() => 0.3333);
    for (const char of code) {
      expect(JAM_CODE_ALPHABET.includes(char)).toBe(true);
    }
  });
});

describe('normalizeJamCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeJamCode('abcdef')).toBe('ABCDEF');
  });

  it('strips hyphens', () => {
    expect(normalizeJamCode('ABC-DEF')).toBe('ABCDEF');
  });

  it('strips spaces', () => {
    expect(normalizeJamCode('ABC DEF')).toBe('ABCDEF');
  });

  it('strips leading/trailing whitespace, hyphens and spaces combined', () => {
    expect(normalizeJamCode('  ab-c d ef ')).toBe('ABCDEF');
  });

  it.each(['ABCDE', 'ABCDEFG'])('rejects wrong length %s', (raw) => {
    expect(normalizeJamCode(raw)).toBeNull();
  });

  it.each(['0', 'O', '1', 'I'])('rejects lookalike glyph %s in the code', (char) => {
    expect(normalizeJamCode(`ABCDE${char}`)).toBeNull();
  });

  it('rejects other non-alphabet characters', () => {
    expect(normalizeJamCode('ABCDE!')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(normalizeJamCode('')).toBeNull();
  });

  it('rejects string of only spaces', () => {
    expect(normalizeJamCode('      ')).toBeNull();
  });

  it('accepts a valid code unchanged', () => {
    expect(normalizeJamCode('A2B3C4')).toBe('A2B3C4');
  });
});

describe('round-trip', () => {
  it('normalizeJamCode(generateJamCode(r)) returns the same code', () => {
    const randoms = [0, 0.1, 0.5, 0.9999999, 1];
    for (const r of randoms) {
      const code = generateJamCode(() => r);
      expect(normalizeJamCode(code)).toBe(code);
    }
  });
});
