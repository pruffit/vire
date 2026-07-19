import { describe, it, expect, vi, beforeEach } from 'vitest';

const { upsertIdentityKey, getIdentityKey } = vi.hoisted(() => ({
  upsertIdentityKey: vi.fn(),
  getIdentityKey: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ upsertIdentityKey, getIdentityKey }));

import { auth } from '@/auth';
import { POST, GET } from './route';

const mockedAuth = vi.mocked(auth);
const USER_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ID = '11111111-1111-1111-1111-111111111111';
// валидный base64 32-байтного ключа (44 символа, оканчивается на '=')
const IK_PUB = 'A'.repeat(43) + '=';

const postReq = (body: unknown) =>
  new Request('http://localhost/api/v1/keys', { method: 'POST', body: JSON.stringify(body) });
const getReq = (userId: string | null) =>
  new Request(`http://localhost/api/v1/keys${userId === null ? '' : `?userId=${userId}`}`);

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/keys', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(postReq({ ikPub: IK_PUB }));
    expect(res.status).toBe(401);
    expect(upsertIdentityKey).not.toHaveBeenCalled();
  });

  it('upserts the identity key for the session user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);
    const res = await POST(postReq({ ikPub: IK_PUB }));
    expect(res.status).toBe(200);
    expect(upsertIdentityKey).toHaveBeenCalledWith(USER_ID, IK_PUB);
  });

  it('400 on malformed ikPub', async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);
    const res = await POST(postReq({ ikPub: 'short' }));
    expect(res.status).toBe(400);
    expect(upsertIdentityKey).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/keys', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(getReq(OTHER_ID));
    expect(res.status).toBe(401);
  });

  it('400 on bad userId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);
    const res = await GET(getReq('nope'));
    expect(res.status).toBe(400);
  });

  it("returns the requested user's public key", async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);
    getIdentityKey.mockResolvedValue(IK_PUB);
    const res = await GET(getReq(OTHER_ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ikPub: IK_PUB });
    expect(getIdentityKey).toHaveBeenCalledWith(OTHER_ID);
  });
});
