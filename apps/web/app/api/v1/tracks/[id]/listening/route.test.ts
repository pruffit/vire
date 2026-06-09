import { describe, it, expect, vi, beforeEach } from 'vitest';

const { recordListening, countListening } = vi.hoisted(() => ({
  recordListening: vi.fn(),
  countListening: vi.fn(),
}));

vi.mock('@/lib/presence', () => ({ recordListening, countListening }));

import { POST, GET } from './route';

const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function postReq(body: unknown): Request {
  return new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/listening`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/tracks/[id]/listening', () => {
  it('400 when sessionId missing or invalid', async () => {
    expect((await POST(postReq({}), ctx)).status).toBe(400);
    expect((await POST(postReq({ sessionId: '' }), ctx)).status).toBe(400);
    expect((await POST(postReq({ sessionId: 'x'.repeat(65) }), ctx)).status).toBe(400);
    expect(recordListening).not.toHaveBeenCalled();
  });

  it('records the heartbeat and returns the live count', async () => {
    recordListening.mockResolvedValue(3);
    const res = await POST(postReq({ sessionId: 'sess-1' }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ count: 3 });
    expect(recordListening).toHaveBeenCalledWith(TRACK_ID, 'sess-1');
  });

  it('degrades to count 0 when Redis throws', async () => {
    recordListening.mockRejectedValue(new Error('redis down'));
    const res = await POST(postReq({ sessionId: 'sess-1' }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ count: 0 });
  });
});

describe('GET /api/v1/tracks/[id]/listening', () => {
  it('returns the current count without recording', async () => {
    countListening.mockResolvedValue(5);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ count: 5 });
    expect(recordListening).not.toHaveBeenCalled();
  });

  it('degrades to count 0 when Redis throws', async () => {
    countListening.mockRejectedValue(new Error('redis down'));
    const res = await GET(new Request('http://localhost'), ctx);
    await expect(res.json()).resolves.toEqual({ count: 0 });
  });
});
