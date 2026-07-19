import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => { process.env.AUTH_SECRET = 'test-secret'; });

describe('notify-unsubscribe', () => {
  it('подпись верифицируется, тампер — нет', async () => {
    const { signNotifyUnsub, verifyNotifyUnsub } = await import('./notify-unsubscribe');
    const tok = signNotifyUnsub('user-1')!;
    expect(verifyNotifyUnsub('user-1', tok)).toBe(true);
    expect(verifyNotifyUnsub('user-2', tok)).toBe(false);
    expect(verifyNotifyUnsub('user-1', tok + 'x')).toBe(false);
  });
});
