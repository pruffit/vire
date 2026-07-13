import { describe, it, expect, vi, beforeEach } from 'vitest';

const { confirmByExternalId, failByExternalId, getPayment } = vi.hoisted(() => ({
  confirmByExternalId: vi.fn(),
  failByExternalId: vi.fn(),
  getPayment: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  clientKey: vi.fn((_req: Request, prefix: string) => `${prefix}:test`),
  tooManyRequests: vi.fn(() => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
}));
vi.mock('@/lib/payment-gateway', () => ({
  YookassaPaymentGateway: class {
    createPayment = vi.fn();
    getPayment = getPayment;
  },
}));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePurchaseRepository: class {
    confirmByExternalId = confirmByExternalId;
    failByExternalId = failByExternalId;
  },
}));

import { POST } from './route';

function req(body: unknown): Request {
  return new Request('http://localhost/api/v1/webhooks/yookassa', {
    method: 'POST',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}

function notification(event: string, paymentId = 'ext-1'): unknown {
  return { type: 'notification', event, object: { id: paymentId } };
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/webhooks/yookassa', () => {
  it('429 when rate-limited', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await POST(req(notification('payment.succeeded')));
    expect(res.status).toBe(429);
    expect(getPayment).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON body', async () => {
    const badReq = new Request('http://localhost/api/v1/webhooks/yookassa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false });
  });

  it('400 when type is not "notification"', async () => {
    const res = await POST(req({ type: 'other', event: 'payment.succeeded', object: { id: 'ext-1' } }));
    expect(res.status).toBe(400);
    expect(getPayment).not.toHaveBeenCalled();
  });

  it('400 when event is missing', async () => {
    const res = await POST(req({ type: 'notification', object: { id: 'ext-1' } }));
    expect(res.status).toBe(400);
    expect(getPayment).not.toHaveBeenCalled();
  });

  it('400 when paymentId is missing', async () => {
    const res = await POST(req({ type: 'notification', event: 'payment.succeeded' }));
    expect(res.status).toBe(400);
    expect(getPayment).not.toHaveBeenCalled();
  });

  it('confirms the purchase when payment.succeeded re-fetches as succeeded', async () => {
    getPayment.mockResolvedValue({ status: 'succeeded', confirmationUrl: null });
    const res = await POST(req(notification('payment.succeeded')));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(confirmByExternalId).toHaveBeenCalledWith('ext-1');
  });

  it('does not confirm a forged succeeded webhook (re-fetch returns a different status)', async () => {
    getPayment.mockResolvedValue({ status: 'pending', confirmationUrl: null });
    const res = await POST(req(notification('payment.succeeded')));
    expect(res.status).toBe(200);
    expect(confirmByExternalId).not.toHaveBeenCalled();
  });

  it('fails the purchase when payment.canceled re-fetches as canceled', async () => {
    getPayment.mockResolvedValue({ status: 'canceled', confirmationUrl: null });
    const res = await POST(req(notification('payment.canceled')));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(failByExternalId).toHaveBeenCalledWith('ext-1');
  });

  it('does not fail a forged canceled webhook (re-fetch returns a different status)', async () => {
    getPayment.mockResolvedValue({ status: 'succeeded', confirmationUrl: null });
    const res = await POST(req(notification('payment.canceled')));
    expect(res.status).toBe(200);
    expect(failByExternalId).not.toHaveBeenCalled();
  });

  it('200 without side effects for unknown events', async () => {
    const res = await POST(req(notification('payment.waiting_for_capture')));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(getPayment).not.toHaveBeenCalled();
    expect(confirmByExternalId).not.toHaveBeenCalled();
    expect(failByExternalId).not.toHaveBeenCalled();
  });
});
