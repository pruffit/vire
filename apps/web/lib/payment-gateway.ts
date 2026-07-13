import type { IPaymentGateway } from '@vire/core';
import { createPayment, getPayment } from '@/lib/yookassa';

export class YookassaPaymentGateway implements IPaymentGateway {
  async createPayment(params: {
    idempotencyKey: string;
    amount: string;
    description: string;
    returnUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; confirmationUrl: string | null }> {
    const payment = await createPayment(params);
    return { id: payment.id, confirmationUrl: payment.confirmation?.confirmation_url ?? null };
  }

  async getPayment(paymentId: string): Promise<{ status: string; confirmationUrl: string | null } | null> {
    const payment = await getPayment(paymentId).catch(() => null);
    if (!payment) return null;
    return { status: payment.status, confirmationUrl: payment.confirmation?.confirmation_url ?? null };
  }
}
