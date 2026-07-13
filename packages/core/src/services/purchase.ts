import { err, ok, NotFoundError, ValidationError, type Result } from '../errors';
import type { IPurchaseRepository } from '../repositories/purchase';

export interface IPaymentGateway {
  isConfigured(): boolean;
  createPayment(params: {
    idempotencyKey: string;
    amount: string;
    description: string;
    returnUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; confirmationUrl: string | null }>;
  getPayment(paymentId: string): Promise<{ status: string; confirmationUrl: string | null } | null>;
}

export interface PurchaseServiceDeps {
  idGen?: () => string;
}

export type PurchaseResult = { alreadyOwned: true } | { confirmationUrl: string | null };

const TRACK_PRICE = '99.00';

export class PurchaseService {
  constructor(
    private readonly repo: IPurchaseRepository,
    private readonly gateway: IPaymentGateway,
    private readonly deps: PurchaseServiceDeps = {},
  ) {}

  async purchase(
    userId: string,
    trackId: string,
    returnUrl: string,
  ): Promise<Result<PurchaseResult, NotFoundError | ValidationError>> {
    if (!(await this.repo.trackExists(trackId))) return err(new NotFoundError('Track', trackId));
    if (await this.repo.hasPurchased(userId, trackId)) return ok({ alreadyOwned: true });
    if (!this.gateway.isConfigured()) return err(new ValidationError('Платёжный сервис не настроен'));

    const existing = await this.repo.getPending(userId, trackId);
    if (existing) {
      const payment = await this.gateway.getPayment(existing.externalPaymentId);
      if (payment?.confirmationUrl) return ok({ confirmationUrl: payment.confirmationUrl });
    }

    const trackTitle = (await this.repo.getTrackTitle(trackId)) ?? trackId;
    const id = this.idGen()();

    const payment = await this.gateway.createPayment({
      idempotencyKey: id,
      amount: TRACK_PRICE,
      description: `Трек: ${trackTitle}`,
      returnUrl,
      metadata: { purchaseId: id },
    });

    await this.repo.createPending({
      id,
      userId,
      trackId,
      price: TRACK_PRICE,
      externalPaymentId: payment.id,
      paymentProvider: 'yookassa',
    });

    return ok({ confirmationUrl: payment.confirmationUrl });
  }

  async handleWebhookEvent(event: string, paymentId: string): Promise<void> {
    if (event === 'payment.succeeded') {
      const payment = await this.gateway.getPayment(paymentId);
      if (payment?.status === 'succeeded') await this.repo.confirmByExternalId(paymentId);
    } else if (event === 'payment.canceled') {
      // re-fetch — иначе подделанный canceled-вебхук пометил бы чужую покупку FAILED
      const payment = await this.gateway.getPayment(paymentId);
      if (payment?.status === 'canceled') await this.repo.failByExternalId(paymentId);
    }
  }

  private idGen(): () => string {
    if (!this.deps.idGen) throw new Error('PurchaseService: deps.idGen is required for purchase');
    return this.deps.idGen;
  }
}
