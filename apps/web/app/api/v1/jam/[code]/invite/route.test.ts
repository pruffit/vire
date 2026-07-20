import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError, NotFoundError } from '@vire/core';

const { resolveCode, assertParticipant } = vi.hoisted(() => ({ resolveCode: vi.fn(), assertParticipant: vi.fn() }));
const { getStatus } = vi.hoisted(() => ({ getStatus: vi.fn() }));
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, assertParticipant }) }));
vi.mock('@/lib/friends', () => ({ friendshipService: () => ({ getStatus }) }));
vi.mock('@/lib/notifications', () => ({ notificationService: () => ({ notify }) }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const FRIEND_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/invite', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const res = await POST(req({ userId: FRIEND_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

    const res = await POST(req({ userId: 'not-a-uuid' }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ userId: FRIEND_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(assertParticipant).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a jam participant', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    assertParticipant.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({ userId: FRIEND_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('403 when the target user is not a friend', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    assertParticipant.mockResolvedValue({ ok: true, value: { id: 'p1' } });
    getStatus.mockResolvedValue('NONE');

    const res = await POST(req({ userId: FRIEND_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
    expect(notify).not.toHaveBeenCalled();
  });

  it('sends a JAM_INVITE notification to a friend', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    assertParticipant.mockResolvedValue({ ok: true, value: { id: 'p1' } });
    getStatus.mockResolvedValue('FRIENDS');

    const res = await POST(req({ userId: FRIEND_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledWith(FRIEND_ID, 'JAM_INVITE', 'u1', 'jam-1');
  });
});
