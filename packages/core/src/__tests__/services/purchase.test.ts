import { describe, it, expect, vi } from 'vitest';
import { PurchaseService } from '../../services/purchase';
import type { IPaymentGateway } from '../../services/purchase';
import { NotFoundError, ValidationError } from '../../errors';
import type { IPurchaseRepository } from '../../repositories/purchase';

const USER_ID = 'user-1';
const TRACK_ID = 'track-1';

function makeRepo(overrides?: Partial<IPurchaseRepository>): IPurchaseRepository {
  return {
    hasPurchased: vi.fn().mockResolvedValue(false),
    getPending: vi.fn().mockResolvedValue(null),
    createPending: vi.fn().mockResolvedValue(undefined),
    confirmByExternalId: vi.fn().mockResolvedValue(undefined),
    failByExternalId: vi.fn().mockResolvedValue(undefined),
    trackExists: vi.fn().mockResolvedValue(true),
    getTrackTitle: vi.fn().mockResolvedValue('Track One'),
    ...overrides,
  };
}

function makeGateway(overrides?: Partial<IPaymentGateway>): IPaymentGateway {
  return {
    isConfigured: vi.fn().mockReturnValue(true),
    createPayment: vi.fn().mockResolvedValue({ id: 'pay-1', confirmationUrl: 'https://pay.example/1' }),
    getPayment: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function service(repo: IPurchaseRepository, gateway: IPaymentGateway, idGen?: () => string) {
  return new PurchaseService(repo, gateway, idGen ? { idGen } : {});
}

describe('PurchaseService.purchase', () => {
  it('returns NotFoundError when the track does not exist', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const gateway = makeGateway();
    const result = await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.hasPurchased).not.toHaveBeenCalled();
  });

  it('returns alreadyOwned when the user already purchased the track', async () => {
    const repo = makeRepo({ hasPurchased: vi.fn().mockResolvedValue(true) });
    const gateway = makeGateway();
    const result = await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ alreadyOwned: true });
    expect(gateway.createPayment).not.toHaveBeenCalled();
    expect(repo.createPending).not.toHaveBeenCalled();
  });

  it('returns ValidationError when the gateway is not configured', async () => {
    const repo = makeRepo();
    const gateway = makeGateway({ isConfigured: vi.fn().mockReturnValue(false) });
    const result = await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.code).toBe('purchase.gatewayNotConfigured');
    }
    expect(repo.getPending).not.toHaveBeenCalled();
    expect(gateway.createPayment).not.toHaveBeenCalled();
  });

  it('alreadyOwned wins over an unconfigured gateway (check order)', async () => {
    const repo = makeRepo({ hasPurchased: vi.fn().mockResolvedValue(true) });
    const gateway = makeGateway({ isConfigured: vi.fn().mockReturnValue(false) });
    const result = await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ alreadyOwned: true });
  });

  it('NotFoundError wins over an unconfigured gateway (check order)', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const gateway = makeGateway({ isConfigured: vi.fn().mockReturnValue(false) });
    const result = await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('reuses a pending purchase when the gateway returns an open confirmation URL', async () => {
    const repo = makeRepo({
      getPending: vi.fn().mockResolvedValue({ id: 'purchase-1', externalPaymentId: 'ext-1' }),
    });
    const gateway = makeGateway({
      getPayment: vi.fn().mockResolvedValue({ status: 'pending', confirmationUrl: 'https://pay.example/reuse' }),
    });
    const result = await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ confirmationUrl: 'https://pay.example/reuse' });
    expect(gateway.getPayment).toHaveBeenCalledWith('ext-1');
    expect(gateway.createPayment).not.toHaveBeenCalled();
  });

  it('falls through to creating a new payment when the pending payment has no confirmation URL', async () => {
    const repo = makeRepo({
      getPending: vi.fn().mockResolvedValue({ id: 'purchase-1', externalPaymentId: 'ext-1' }),
    });
    const gateway = makeGateway({
      getPayment: vi.fn().mockResolvedValue({ status: 'succeeded', confirmationUrl: null }),
    });
    const result = await service(repo, gateway, () => 'id-2').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(true);
    expect(gateway.createPayment).toHaveBeenCalledTimes(1);
  });

  it('falls through to creating a new payment when the pending payment lookup fails (null)', async () => {
    const repo = makeRepo({
      getPending: vi.fn().mockResolvedValue({ id: 'purchase-1', externalPaymentId: 'ext-1' }),
    });
    const gateway = makeGateway({ getPayment: vi.fn().mockResolvedValue(null) });
    const result = await service(repo, gateway, () => 'id-2').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(true);
    expect(gateway.createPayment).toHaveBeenCalledTimes(1);
  });

  it('creates a payment then records the pending purchase, in that order, with the expected arguments', async () => {
    const calls: string[] = [];
    const repo = makeRepo({
      createPending: vi.fn().mockImplementation(async () => {
        calls.push('createPending');
      }),
    });
    const gateway = makeGateway({
      createPayment: vi.fn().mockImplementation(async () => {
        calls.push('createPayment');
        return { id: 'ext-new', confirmationUrl: 'https://pay.example/new' };
      }),
    });

    const result = await service(repo, gateway, () => 'purchase-id').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ confirmationUrl: 'https://pay.example/new' });
    expect(calls).toEqual(['createPayment', 'createPending']);

    expect(gateway.createPayment).toHaveBeenCalledWith({
      idempotencyKey: 'purchase-id',
      amount: '99.00',
      description: 'Трек: Track One',
      returnUrl: 'https://return',
      metadata: { purchaseId: 'purchase-id' },
    });
    expect(repo.createPending).toHaveBeenCalledWith({
      id: 'purchase-id',
      userId: USER_ID,
      trackId: TRACK_ID,
      price: '99.00',
      externalPaymentId: 'ext-new',
      paymentProvider: 'yookassa',
    });
  });

  it('passes through a null confirmationUrl from a freshly created payment', async () => {
    const repo = makeRepo();
    const gateway = makeGateway({
      createPayment: vi.fn().mockResolvedValue({ id: 'ext-new', confirmationUrl: null }),
    });
    const result = await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ confirmationUrl: null });
    expect(repo.createPending).toHaveBeenCalledTimes(1);
  });

  it('falls back to the track id for the description when the title is missing', async () => {
    const repo = makeRepo({ getTrackTitle: vi.fn().mockResolvedValue(null) });
    const gateway = makeGateway();
    await service(repo, gateway, () => 'id-1').purchase(USER_ID, TRACK_ID, 'https://return');

    expect(gateway.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ description: `Трек: ${TRACK_ID}` }),
    );
  });

  it('throws when deps.idGen is not provided', async () => {
    const repo = makeRepo();
    const gateway = makeGateway();
    await expect(service(repo, gateway).purchase(USER_ID, TRACK_ID, 'https://return'))
      .rejects.toThrow('deps.idGen is required for purchase');
  });
});

describe('PurchaseService.handleWebhookEvent', () => {
  it('confirms the purchase when payment.succeeded re-fetches as succeeded', async () => {
    const repo = makeRepo();
    const gateway = makeGateway({ getPayment: vi.fn().mockResolvedValue({ status: 'succeeded', confirmationUrl: null }) });
    await service(repo, gateway).handleWebhookEvent('payment.succeeded', 'ext-1');

    expect(repo.confirmByExternalId).toHaveBeenCalledWith('ext-1');
    expect(repo.failByExternalId).not.toHaveBeenCalled();
  });

  it('does nothing when payment.succeeded re-fetches with a different status (forged webhook)', async () => {
    const repo = makeRepo();
    const gateway = makeGateway({ getPayment: vi.fn().mockResolvedValue({ status: 'canceled', confirmationUrl: null }) });
    await service(repo, gateway).handleWebhookEvent('payment.succeeded', 'ext-1');

    expect(repo.confirmByExternalId).not.toHaveBeenCalled();
  });

  it('fails the purchase when payment.canceled re-fetches as canceled', async () => {
    const repo = makeRepo();
    const gateway = makeGateway({ getPayment: vi.fn().mockResolvedValue({ status: 'canceled', confirmationUrl: null }) });
    await service(repo, gateway).handleWebhookEvent('payment.canceled', 'ext-1');

    expect(repo.failByExternalId).toHaveBeenCalledWith('ext-1');
    expect(repo.confirmByExternalId).not.toHaveBeenCalled();
  });

  it('does nothing when payment.canceled re-fetches with a different status (forged webhook)', async () => {
    const repo = makeRepo();
    const gateway = makeGateway({ getPayment: vi.fn().mockResolvedValue({ status: 'succeeded', confirmationUrl: null }) });
    await service(repo, gateway).handleWebhookEvent('payment.canceled', 'ext-1');

    expect(repo.failByExternalId).not.toHaveBeenCalled();
  });

  it('does nothing for unknown events', async () => {
    const repo = makeRepo();
    const gateway = makeGateway();
    await service(repo, gateway).handleWebhookEvent('payment.waiting_for_capture', 'ext-1');

    expect(gateway.getPayment).not.toHaveBeenCalled();
    expect(repo.confirmByExternalId).not.toHaveBeenCalled();
    expect(repo.failByExternalId).not.toHaveBeenCalled();
  });

  it('does nothing when the re-fetch fails (getPayment returns null)', async () => {
    const repo = makeRepo();
    const gateway = makeGateway({ getPayment: vi.fn().mockResolvedValue(null) });
    await service(repo, gateway).handleWebhookEvent('payment.succeeded', 'ext-1');

    expect(repo.confirmByExternalId).not.toHaveBeenCalled();
    expect(repo.failByExternalId).not.toHaveBeenCalled();
  });
});
