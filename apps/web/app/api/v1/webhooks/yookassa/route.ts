import { NextResponse } from 'next/server';
import { confirmPurchaseByExternalId, failPurchaseByExternalId } from '@vire/db';
import { getPayment } from '@/lib/yookassa';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

// каждое событие верифицируется re-fetch'ем платежа из API перед действием
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

  if (event === 'payment.succeeded') {
    const payment = await getPayment(paymentId).catch(() => null);
    if (payment?.status === 'succeeded') {
      await confirmPurchaseByExternalId(paymentId);
    }
  } else if (event === 'payment.canceled') {
    // re-fetch — иначе подделанный canceled-вебхук пометил бы чужую покупку FAILED
    const payment = await getPayment(paymentId).catch(() => null);
    if (payment?.status === 'canceled') {
      await failPurchaseByExternalId(paymentId);
    }
  }

  // всегда 200 — чтобы ЮKassa не ретраила неизвестные события
  return NextResponse.json({ ok: true });
}
