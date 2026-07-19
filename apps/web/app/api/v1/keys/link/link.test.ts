import { describe, it, expect, vi, beforeEach } from 'vitest';

const { startLink, getLink, attachLink, revealLink, completeLink, publish } = vi.hoisted(() => ({
  startLink: vi.fn(),
  getLink: vi.fn(),
  attachLink: vi.fn(),
  revealLink: vi.fn(),
  completeLink: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/link-session', () => ({ startLink, getLink, attachLink, revealLink, completeLink }));
vi.mock('@/lib/realtime', () => ({ publish }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));

import { auth } from '@/auth';
import { POST as startPOST } from './start/route';
import { GET as pollGET } from './poll/route';
import { POST as attachPOST } from './attach/route';
import { POST as revealPOST } from './reveal/route';
import { POST as completePOST } from './complete/route';

const mockedAuth = vi.mocked(auth);
const USER_ID = '22222222-2222-2222-2222-222222222222';
const LINK_ID = '33333333-3333-3333-3333-333333333333';
const PUB = 'A'.repeat(43) + '=';

const authed = () => mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);
const anon = () => mockedAuth.mockResolvedValue(null as never);

beforeEach(() => vi.clearAllMocks());

describe('POST /keys/link/start', () => {
  it('401 without auth', async () => {
    anon();
    const res = await startPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify({ ebPub: PUB }) }));
    expect(res.status).toBe(401);
  });

  it('creates a session from a commitment and notifies other devices', async () => {
    authed();
    startLink.mockResolvedValue(LINK_ID);
    const res = await startPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify({ commit: PUB }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ linkId: LINK_ID });
    expect(startLink).toHaveBeenCalledWith(USER_ID, PUB);
    expect(publish).toHaveBeenCalledWith(USER_ID, { type: 'link-request', linkId: LINK_ID });
  });
});

describe('POST /keys/link/reveal', () => {
  const body = { linkId: LINK_ID, ebPub: PUB };

  it('401 without auth', async () => {
    anon();
    const res = await revealPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(401);
  });

  it('reveals the new-device ephemeral key', async () => {
    authed();
    revealLink.mockResolvedValue(true);
    const res = await revealPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(200);
    expect(revealLink).toHaveBeenCalledWith(LINK_ID, USER_ID, PUB);
  });

  it('409 when not ready to reveal', async () => {
    authed();
    revealLink.mockResolvedValue(false);
    const res = await revealPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(409);
  });
});

describe('GET /keys/link/poll', () => {
  it('401 without auth', async () => {
    anon();
    const res = await pollGET(new Request(`http://localhost/x?linkId=${LINK_ID}`));
    expect(res.status).toBe(401);
  });

  it('404 when the session is not the callers', async () => {
    authed();
    getLink.mockResolvedValue(null);
    const res = await pollGET(new Request(`http://localhost/x?linkId=${LINK_ID}`));
    expect(res.status).toBe(404);
    expect(getLink).toHaveBeenCalledWith(LINK_ID, USER_ID);
  });

  it('returns the link state to its owner', async () => {
    authed();
    const state = { userId: USER_ID, ebPub: PUB, status: 'pending' };
    getLink.mockResolvedValue(state);
    const res = await pollGET(new Request(`http://localhost/x?linkId=${LINK_ID}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(state);
  });
});

describe('POST /keys/link/attach', () => {
  const body = { linkId: LINK_ID, eaPub: PUB };

  it('401 without auth', async () => {
    anon();
    const res = await attachPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(401);
  });

  it('attaches the existing device ephemeral key', async () => {
    authed();
    attachLink.mockResolvedValue(true);
    const res = await attachPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(200);
    expect(attachLink).toHaveBeenCalledWith(LINK_ID, USER_ID, PUB);
  });
});

describe('POST /keys/link/complete', () => {
  const body = { linkId: LINK_ID, wrapped: 'd3JhcHBlZA==', nonce: 'bm9uY2U=' };

  it('401 without auth', async () => {
    anon();
    const res = await completePOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(401);
  });

  it('409 when the session is not ready', async () => {
    authed();
    completeLink.mockResolvedValue(false);
    const res = await completePOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(409);
  });

  it('completes the link with the wrapped key', async () => {
    authed();
    completeLink.mockResolvedValue(true);
    const res = await completePOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(200);
    expect(completeLink).toHaveBeenCalledWith(LINK_ID, USER_ID, body.wrapped, body.nonce);
  });
});
