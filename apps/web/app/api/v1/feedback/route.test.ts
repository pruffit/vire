import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rateLimit, sendMail } = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'feedback:test'),
  tooManyRequests: vi.fn((retryAfter: number) => new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: { 'Retry-After': String(retryAfter) },
  })),
}));
vi.mock('@/lib/mailer', () => ({ sendMail }));

import { POST } from './route';

function req(body: unknown | string): Request {
  return new Request('http://localhost/api/v1/feedback', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfter: 0 });
  sendMail.mockResolvedValue(undefined);
});

describe('POST /api/v1/feedback', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 3600 });
    const res = await POST(req({ type: 'bug', message: 'Something is broken here' }));
    expect(res.status).toBe(429);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('400 on malformed JSON', async () => {
    const res = await POST(req('{bad json'));
    expect(res.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('400 when the message is too short', async () => {
    const res = await POST(req({ type: 'bug', message: 'short' }));
    expect(res.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('400 on an invalid feedback type', async () => {
    const res = await POST(req({ type: 'spam', message: 'Something is broken here' }));
    expect(res.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('502 when sending the mail fails', async () => {
    sendMail.mockRejectedValue(new Error('Brevo API 500'));
    const res = await POST(req({ type: 'bug', message: 'Something is broken here' }));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'Не удалось отправить сообщение' });
  });

  it('happy path: sends the mail and returns ok', async () => {
    const res = await POST(req({
      type: 'idea',
      message: 'Add dark mode please',
      page: '/dashboard',
      email: 'user@example.com',
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'noreply@viremusic.ru',
      subject: expect.stringContaining('Идея'),
      text: expect.stringContaining('Add dark mode please'),
      replyTo: 'user@example.com',
    }));
  });
});
