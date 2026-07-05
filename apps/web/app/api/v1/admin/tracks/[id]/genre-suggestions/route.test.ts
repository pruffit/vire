import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getGenreSuggestionsSnapshot } = vi.hoisted(() => ({
  getGenreSuggestionsSnapshot: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ getGenreSuggestionsSnapshot }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function makeReq(): Request {
  return new Request(`http://localhost/api/v1/admin/tracks/${TRACK_ID}/genre-suggestions`);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/admin/tracks/[id]/genre-suggestions', () => {
  it('403 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(403);
  });

  it('403 for a VIEWER (read-only role, not MODERATOR+)', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'VIEWER' } } as never);
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(403);
  });

  it('400 on a malformed track id', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'MODERATOR' } } as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(400);
  });

  it('returns the snapshot for MODERATOR+', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'MODERATOR' } } as never);
    getGenreSuggestionsSnapshot.mockResolvedValue({
      suggestions: [{ genre: 'AMBIENT', confidence: 0.5 }],
      updatedAt: '2026-07-05T00:00:00.000Z',
    });
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      suggestions: [{ genre: 'AMBIENT', confidence: 0.5 }],
      updatedAt: '2026-07-05T00:00:00.000Z',
    });
  });
});
