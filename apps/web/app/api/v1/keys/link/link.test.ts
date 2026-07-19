import { describe, it, expect, vi, beforeEach } from 'vitest';

const { startLink, getLink, completeLink, publish } = vi.hoisted(() => ({
  startLink: vi.fn(),
  getLink: vi.fn(),
  completeLink: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/link-session', () => ({ startLink, getLink, completeLink }));
vi.mock('@/lib/realtime', () => ({ publish }));

import { auth } from '@/auth';
import { POST as startPOST } from './start/route';
import { GET as pollGET } from './poll/route';
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

  it('creates a session and notifies other devices', async () => {
    authed();
    startLink.mockResolvedValue(LINK_ID);
    const res = await startPOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify({ ebPub: PUB }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ linkId: LINK_ID });
    expect(startLink).toHaveBeenCalledWith(USER_ID, PUB);
    expect(publish).toHaveBeenCalledWith(USER_ID, { type: 'link-request', linkId: LINK_ID });
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

describe('POST /keys/link/complete', () => {
  const body = { linkId: LINK_ID, eaPub: PUB, wrapped: 'd3JhcHBlZA==', nonce: 'bm9uY2U=' };

  it('401 without auth', async () => {
    anon();
    const res = await completePOST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(401);
  });

  it('409 when the session is not pending', async () => {
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
    expect(completeLink).toHaveBeenCalledWith(LINK_ID, USER_ID, PUB, body.wrapped, body.nonce);
  });
});
