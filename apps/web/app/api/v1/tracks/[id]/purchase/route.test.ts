import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  trackExists, hasPurchased, getPending, createPending, getTrackTitle,
  createPayment, getPayment, isConfigured,
} = vi.hoisted(() => ({
  trackExists: vi.fn(),
  hasPurchased: vi.fn(),
  getPending: vi.fn(),
  createPending: vi.fn(),
  getTrackTitle: vi.fn(),
  createPayment: vi.fn(),
  getPayment: vi.fn(),
  isConfigured: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/yookassa', () => ({ isConfigured }));
vi.mock('@/lib/payment-gateway', () => ({
  YookassaPaymentGateway: class {
    createPayment = createPayment;
    getPayment = getPayment;
  },
}));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePurchaseRepository: class {
    trackExists = trackExists;
    hasPurchased = hasPurchased;
    getPending = getPending;
    createPending = createPending;
    getTrackTitle = getTrackTitle;
  },
}));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function req(body?: unknown) {
  return new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/purchase`, {
    method: 'POST',
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  isConfigured.mockReturnValue(true);
  trackExists.mockResolvedValue(true);
  hasPurchased.mockResolvedValue(false);
  getPending.mockResolvedValue(null);
  getTrackTitle.mockResolvedValue('Track One');
  createPayment.mockResolvedValue({ id: 'ext-1', confirmationUrl: 'https://pay.example/1' });
});

describe('POST /api/v1/tracks/[id]/purchase', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(401);
    expect(trackExists).not.toHaveBeenCalled();
  });

  it('503 when the payment service is not configured', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    isConfigured.mockReturnValue(false);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'Платёжный сервис не настроен' });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(false);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('returns alreadyOwned when the track was already purchased', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    hasPurchased.mockResolvedValue(true);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, alreadyOwned: true });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('reuses a pending purchase with an open confirmation URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPending.mockResolvedValue({ id: 'purchase-1', externalPaymentId: 'ext-existing' });
    getPayment.mockResolvedValue({ status: 'pending', confirmationUrl: 'https://pay.example/reuse' });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ confirmationUrl: 'https://pay.example/reuse' });
    expect(getPayment).toHaveBeenCalledWith('ext-existing');
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('creates a new payment and returns its confirmation URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(req({ returnUrl: 'https://vire.example/thanks' }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ confirmationUrl: 'https://pay.example/1' });
    expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: '99.00',
      description: 'Трек: Track One',
      returnUrl: 'https://vire.example/thanks',
    }));
    expect(createPending).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      trackId: TRACK_ID,
      price: '99.00',
      externalPaymentId: 'ext-1',
      paymentProvider: 'yookassa',
    }));
  });
});
