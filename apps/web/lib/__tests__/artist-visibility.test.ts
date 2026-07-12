import { describe, expect, it } from 'vitest';
import { canViewEmptyArtist } from '../artist-visibility';

describe('canViewEmptyArtist', () => {
  it.each([
    [{ isMember: false, role: null }, false],
    [{ isMember: false, role: undefined }, false],
    [{ isMember: false, role: 'LISTENER' }, false],
    [{ isMember: false, role: 'ARTIST' }, false],
    [{ isMember: false, role: 'VIEWER' }, false],
    [{ isMember: false, role: 'MODERATOR' }, true],
    [{ isMember: false, role: 'ADMIN' }, true],
    [{ isMember: false, role: 'SUPERADMIN' }, true],
    [{ isMember: true, role: null }, true],
    [{ isMember: true, role: 'LISTENER' }, true],
  ])('%o → %s', (input, expected) => {
    expect(canViewEmptyArtist(input)).toBe(expected);
  });
});
