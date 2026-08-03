import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError } from '@vire/core';

const { history } = vi.hoisted(() => ({ history: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/chat', () => ({ chatService: () => ({ history }) }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

const SELF_ID = '22222222-2222-2222-2222-222222222222';
const CONV_ID = '33333333-3333-3333-3333-333333333333';

const ctx = (id: string) => ({ params: Promise.resolve({ conversationId: id }) });
const req = (qs = '') => new Request(`http://localhost/api/v1/chat/${CONV_ID}/messages${qs}`);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/chat/[conversationId]/messages', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req(), ctx(CONV_ID));
    expect(res.status).toBe(401);
    expect(history).not.toHaveBeenCalled();
  });

  it('400 on invalid conversationId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await GET(req(), ctx('not-a-uuid'));
    expect(res.status).toBe(400);
    expect(history).not.toHaveBeenCalled();
  });

  it('400 on invalid before', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await GET(req(`?before=notadate&beforeId=${CONV_ID}`), ctx(CONV_ID));
    expect(res.status).toBe(400);
  });

  it('400 when before is present without beforeId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await GET(req('?before=2026-01-01T00:00:00.000Z'), ctx(CONV_ID));
    expect(res.status).toBe(400);
    expect(history).not.toHaveBeenCalled();
  });

  it('400 when beforeId is present without before', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await GET(req(`?beforeId=${CONV_ID}`), ctx(CONV_ID));
    expect(res.status).toBe(400);
    expect(history).not.toHaveBeenCalled();
  });

  it('400 when beforeId is not a valid uuid', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await GET(req('?before=2026-01-01T00:00:00.000Z&beforeId=not-a-uuid'), ctx(CONV_ID));
    expect(res.status).toBe(400);
  });

  it('valid cursor is passed through to history', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    history.mockResolvedValue({ ok: true, value: [] });
    const iso = '2026-01-01T00:00:00.000Z';
    const res = await GET(req(`?before=${iso}&beforeId=${CONV_ID}`), ctx(CONV_ID));
    expect(res.status).toBe(200);
    expect(history).toHaveBeenCalledWith(SELF_ID, CONV_ID, { createdAt: new Date(iso), id: CONV_ID }, 50);
  });

  it('404 when not a participant', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    history.mockResolvedValue({ ok: false, error: new NotFoundError('Conversation', CONV_ID) });
    const res = await GET(req(), ctx(CONV_ID));
    expect(res.status).toBe(404);
  });

  it('403 when forbidden', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    history.mockResolvedValue({ ok: false, error: new ForbiddenError('Not a participant') });
    const res = await GET(req(), ctx(CONV_ID));
    expect(res.status).toBe(403);
  });

  it('returns messages', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    history.mockResolvedValue({ ok: true, value: [{ id: 'm1' }] });
    const res = await GET(req(), ctx(CONV_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ messages: [{ id: 'm1' }] });
    expect(history).toHaveBeenCalledWith(SELF_ID, CONV_ID, null, 50);
  });
});
