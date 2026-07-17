import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createPayment, getPayment, isConfigured } = vi.hoisted(() => ({
  createPayment: vi.fn(),
  getPayment: vi.fn(),
  isConfigured: vi.fn(),
}));

vi.mock('@/lib/yookassa', () => ({ createPayment, getPayment, isConfigured }));

import { YookassaPaymentGateway } from './payment-gateway';

const params = {
  idempotencyKey: 'idem-1',
  amount: '99.00',
  description: 'Трек: Track One',
  returnUrl: 'https://vire.example/thanks',
  metadata: { purchaseId: 'p-1' },
};

const gateway = () => new YookassaPaymentGateway();

beforeEach(() => vi.clearAllMocks());

describe('YookassaPaymentGateway.isConfigured', () => {
  it('delegates to lib/yookassa.isConfigured', () => {
    isConfigured.mockReturnValue(true);
    expect(gateway().isConfigured()).toBe(true);
    isConfigured.mockReturnValue(false);
    expect(gateway().isConfigured()).toBe(false);
  });
});

describe('YookassaPaymentGateway.createPayment', () => {
  it('maps confirmation.confirmation_url to confirmationUrl', async () => {
    createPayment.mockResolvedValue({ id: 'ext-1', status: 'pending', confirmation: { type: 'redirect', confirmation_url: 'https://pay/1' } });
    await expect(gateway().createPayment(params)).resolves.toEqual({ id: 'ext-1', confirmationUrl: 'https://pay/1' });
    expect(createPayment).toHaveBeenCalledWith(params);
  });

  it('returns null confirmationUrl when the payment has no confirmation', async () => {
    createPayment.mockResolvedValue({ id: 'ext-2', status: 'pending' });
    await expect(gateway().createPayment(params)).resolves.toEqual({ id: 'ext-2', confirmationUrl: null });
  });
});

describe('YookassaPaymentGateway.getPayment', () => {
  it('maps status and confirmation_url', async () => {
    getPayment.mockResolvedValue({ id: 'ext-9', status: 'succeeded', confirmation: { type: 'redirect', confirmation_url: 'https://pay/9' } });
    await expect(gateway().getPayment('ext-9')).resolves.toEqual({ status: 'succeeded', confirmationUrl: 'https://pay/9' });
  });

  it('returns null confirmationUrl when the payment has no confirmation', async () => {
    getPayment.mockResolvedValue({ id: 'ext-3', status: 'pending' });
    await expect(gateway().getPayment('ext-3')).resolves.toEqual({ status: 'pending', confirmationUrl: null });
  });

  it('swallows a failing lookup and returns null', async () => {
    getPayment.mockRejectedValue(new Error('YooKassa getPayment failed: 500'));
    await expect(gateway().getPayment('boom')).resolves.toBeNull();
  });
});
