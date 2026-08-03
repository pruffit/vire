import { describe, it, expect } from 'vitest';
import {
  PRESENCE_TRACK_PREFIX,
  PRESENCE_USER_PREFIX,
  PRESENCE_SITE_KEY,
  presenceTrackKey,
  presenceUserKey,
} from '../presence-keys';

describe('presence keys', () => {
  it('строит ключ трека по префиксу', () => {
    expect(presenceTrackKey('t-1')).toBe('presence:track:t-1');
    expect(presenceTrackKey('t-1').startsWith(PRESENCE_TRACK_PREFIX)).toBe(true);
  });

  it('строит ключ пользователя по префиксу', () => {
    expect(presenceUserKey('u-1')).toBe('presence:user:u-1');
    expect(presenceUserKey('u-1').startsWith(PRESENCE_USER_PREFIX)).toBe(true);
  });

  it('trackId восстанавливается срезом префикса (listListening)', () => {
    expect(presenceTrackKey('abc').slice(PRESENCE_TRACK_PREFIX.length)).toBe('abc');
  });

  it('ключ сайта отличается от префиксов трека и пользователя', () => {
    expect(PRESENCE_SITE_KEY).toBe('presence:site');
    expect(PRESENCE_SITE_KEY.startsWith(PRESENCE_TRACK_PREFIX)).toBe(false);
    expect(PRESENCE_SITE_KEY.startsWith(PRESENCE_USER_PREFIX)).toBe(false);
  });
});
