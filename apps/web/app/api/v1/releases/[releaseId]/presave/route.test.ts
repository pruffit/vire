import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getReleasePresaveInfo, presaveForUser, unpresaveForUser, presaveForGuest, getPresaveState } =
  vi.hoisted(() => ({
    getReleasePresaveInfo: vi.fn(),
    presaveForUser: vi.fn(),
    unpresaveForUser: vi.fn(),
    presaveForGuest: vi.fn(),
    getPresaveState: vi.fn(),
  }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  clientKey: vi.fn((_req: Request, prefix: string) => `${prefix}:test`),
  tooManyRequests: vi.fn(() => new Response('rate', { status: 429 })),
}));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePresaveRepository: class {
    getReleaseInfo = getReleasePresaveInfo;
    presaveForUser = presaveForUser;
    unpresaveForUser = unpresaveForUser;
    presaveForGuest = presaveForGuest;
    getState = getPresaveState;
  },
}));

import { auth } from '@/auth';
import { GET, POST, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const RELEASE_ID = 'rel-1';
const ctx = { params: Promise.resolve({ releaseId: RELEASE_ID }) };

// Релиз пресейвабелен: запланирован на будущее.
const future = () => ({
  id: RELEASE_ID,
  status: 'SCHEDULED' as const,
  releaseDate: new Date(Date.now() + 86_400_000),
});

function req(body?: unknown) {
  return new Request(`http://localhost/api/v1/releases/${RELEASE_ID}/presave`, {
    method: 'POST',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/releases/[id]/presave', () => {
  it('returns presaved: false when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ presaved: false });
    expect(getPresaveState).not.toHaveBeenCalled();
  });

  it('reads the presave state for a logged-in user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPresaveState.mockResolvedValue(true);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ presaved: true });
    expect(getPresaveState).toHaveBeenCalledWith('u1', RELEASE_ID);
  });
});

describe('POST /api/v1/releases/[id]/presave', () => {
  it('404 when the release does not exist', async () => {
    getReleasePresaveInfo.mockResolvedValue(null);
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Release not found: rel-1', code: 'release.notFound' });
    expect(presaveForUser).not.toHaveBeenCalled();
  });

  it('400 when the release already came out', async () => {
    getReleasePresaveInfo.mockResolvedValue({
      id: RELEASE_ID, status: 'PUBLISHED', releaseDate: new Date(Date.now() - 1000),
    });
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Пресейв недоступен: релиз уже вышел или не запланирован',
      code: 'presave.notPresavable',
    });
    expect(presaveForUser).not.toHaveBeenCalled();
  });

  it('presaves for a logged-in user', async () => {
    getReleasePresaveInfo.mockResolvedValue(future());
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ presaved: true });
    expect(presaveForUser).toHaveBeenCalledWith('u1', RELEASE_ID);
    expect(presaveForGuest).not.toHaveBeenCalled();
  });

  it('presaves a guest by email (lowercased)', async () => {
    getReleasePresaveInfo.mockResolvedValue(future());
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req({ email: 'Fan@Example.COM' }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ presaved: true, guest: true });
    expect(presaveForGuest).toHaveBeenCalledWith('fan@example.com', RELEASE_ID);
  });

  it('400 when a guest sends an invalid email', async () => {
    getReleasePresaveInfo.mockResolvedValue(future());
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req({ email: 'not-an-email' }), ctx);
    expect(res.status).toBe(400);
    expect(presaveForGuest).not.toHaveBeenCalled();
  });

  it('429 when the guest IP is rate-limited (before the email limit)', async () => {
    getReleasePresaveInfo.mockResolvedValue(future());
    mockedAuth.mockResolvedValue(null as never);
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 3600 });
    const res = await POST(req({ email: 'fan@example.com' }), ctx);
    expect(res.status).toBe(429);
    expect(presaveForGuest).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/releases/[id]/presave', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(401);
    expect(unpresaveForUser).not.toHaveBeenCalled();
  });

  it('removes the presave', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ presaved: false });
    expect(unpresaveForUser).toHaveBeenCalledWith('u1', RELEASE_ID);
  });
});
