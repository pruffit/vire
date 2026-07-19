import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { updateUserNotifyEmail } = vi.hoisted(() => ({
  updateUserNotifyEmail: vi.fn(),
}));

vi.mock('@vire/db', () => ({ updateUserNotifyEmail }));

import { GET } from './route';
import { signNotifyUnsub } from '@/lib/notify-unsubscribe';

const UID = 'user-1';
const savedSecret = process.env.AUTH_SECRET;

function reqFor(uid: string, token: string): Request {
  const url = new URL('http://localhost/api/v1/notifications/unsubscribe');
  url.searchParams.set('uid', uid);
  url.searchParams.set('token', token);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = 'test-secret';
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = savedSecret;
});

describe('GET /api/v1/notifications/unsubscribe', () => {
  it('valid token -> 200 and updates notify_email to false', async () => {
    const token = signNotifyUnsub(UID)!;
    const res = await GET(reqFor(UID, token));
    expect(res.status).toBe(200);
    expect(updateUserNotifyEmail).toHaveBeenCalledWith(UID, false);
  });

  it('invalid token -> 400, no update', async () => {
    const res = await GET(reqFor(UID, 'deadbeef'.repeat(4)));
    expect(res.status).toBe(400);
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });

  it('missing uid/token -> 400, no update', async () => {
    const res = await GET(reqFor('', ''));
    expect(res.status).toBe(400);
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });
});
