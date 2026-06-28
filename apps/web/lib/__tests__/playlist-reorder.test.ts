import { describe, it, expect } from 'vitest';
import { isPermutation } from '@vire/db';

describe('isPermutation', () => {
  it('true for same set different order', () => {
    expect(isPermutation(['b', 'a'], ['a', 'b'])).toBe(true);
  });
  it('false for missing id', () => {
    expect(isPermutation(['a', 'x'], ['a', 'b'])).toBe(false);
  });
  it('false for length mismatch', () => {
    expect(isPermutation(['a'], ['a', 'b'])).toBe(false);
  });
});
