import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest: request }));

import { openConversation, fetchMessages, sendMessage, fetchPeerKey } from '../chat';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openConversation', () => {
  it('POST /api/v1/chat/open с телом {userId}', async () => {
    request.mockResolvedValue({ ok: true, data: { conversationId: 'c1' } });

    await openConversation('u1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/chat/open',
      expect.objectContaining({ method: 'POST', body: { userId: 'u1' }, schema: expect.anything() }),
    );
  });
});

describe('fetchMessages', () => {
  it('GET /api/v1/chat/{conversationId}/messages без курсора', async () => {
    request.mockResolvedValue({ ok: true, data: { messages: [] } });

    await fetchMessages('c1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/chat/c1/messages',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('с курсором — добавляет ?before=&beforeId=', async () => {
    request.mockResolvedValue({ ok: true, data: { messages: [] } });

    await fetchMessages('c1', { createdAt: '2026-08-20T10:00:00.000Z', id: 'm1' });

    expect(request).toHaveBeenCalledWith(
      `/api/v1/chat/c1/messages?before=${encodeURIComponent('2026-08-20T10:00:00.000Z')}&beforeId=m1`,
      expect.anything(),
    );
  });

  it('экранирует conversationId', async () => {
    request.mockResolvedValue({ ok: true, data: { messages: [] } });

    await fetchMessages('a b/c');

    expect(request).toHaveBeenCalledWith(
      `/api/v1/chat/${encodeURIComponent('a b/c')}/messages`,
      expect.anything(),
    );
  });
});

describe('sendMessage', () => {
  it('POST /api/v1/chat/messages с телом {toUserId, ciphertext, nonce}', async () => {
    request.mockResolvedValue({
      ok: true,
      data: { conversationId: 'c1', message: { id: 'm1', conversationId: 'c1', senderId: 'u1', body: 'ct', nonce: 'n', createdAt: '2026-08-23T00:00:00.000Z' } },
    });

    await sendMessage('u2', 'ct', 'n');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/chat/messages',
      expect.objectContaining({ method: 'POST', body: { toUserId: 'u2', ciphertext: 'ct', nonce: 'n' } }),
    );
  });
});

describe('fetchPeerKey', () => {
  it('GET /api/v1/keys?userId=...', async () => {
    request.mockResolvedValue({ ok: true, data: { ikPub: null } });

    await fetchPeerKey('u1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/keys?userId=u1',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('экранирует userId', async () => {
    request.mockResolvedValue({ ok: true, data: { ikPub: null } });

    await fetchPeerKey('a b/c');

    expect(request).toHaveBeenCalledWith(
      `/api/v1/keys?userId=${encodeURIComponent('a b/c')}`,
      expect.anything(),
    );
  });
});
