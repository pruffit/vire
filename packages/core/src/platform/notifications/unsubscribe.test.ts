import { describe, it, expect } from 'vitest';
import { signNotifyUnsub, verifyNotifyUnsub } from './unsubscribe';

describe('notifications/unsubscribe', () => {
  it('подпись верифицируется, тампер и чужой userId — нет', () => {
    const secret = 'test-secret';
    const tok = signNotifyUnsub(secret, 'user-1');
    expect(verifyNotifyUnsub(secret, 'user-1', tok)).toBe(true);
    expect(verifyNotifyUnsub(secret, 'user-2', tok)).toBe(false);
    expect(verifyNotifyUnsub(secret, 'user-1', tok + 'x')).toBe(false);
  });

  it('другой секрет не верифицируется', () => {
    const tok = signNotifyUnsub('secret-a', 'user-1');
    expect(verifyNotifyUnsub('secret-b', 'user-1', tok)).toBe(false);
  });
});
