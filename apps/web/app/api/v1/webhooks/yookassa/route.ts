import { NextResponse } from 'next/server';
import { db, DrizzlePurchaseRepository } from '@vire/db';
import { PurchaseService } from '@vire/core';
import { YookassaPaymentGateway } from '@/lib/payment-gateway';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req: Request) {
  // без лимита эндпоинт флудится произвольными paymentId (каждый = внешний вызов getPayment)
  const rl = await rateLimit(clientKey(req, 'yookassa-webhook'), 120, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body || body.type !== 'notification') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = body.event as string | undefined;
  const paymentId = (body.object as Record<string, unknown> | undefined)?.id as string | undefined;

  if (!event || !paymentId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const service = new PurchaseService(new DrizzlePurchaseRepository(db), new YookassaPaymentGateway());
  await service.handleWebhookEvent(event, paymentId);

  // всегда 200 — чтобы ЮKassa не ретраила неизвестные события
  return NextResponse.json({ ok: true });
}
