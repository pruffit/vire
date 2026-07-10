import { NextResponse } from 'next/server';
import { confirmPurchaseByExternalId, failPurchaseByExternalId } from '@vire/db';
import { getPayment } from '@/lib/yookassa';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

// YooKassa sends webhooks for payment.succeeded and payment.canceled events.
// We verify each event by re-fetching the payment from the API before acting.
export async function POST(req: Request) {
  // Каждый принятый вебхук порождает внешний вызов getPayment — без лимита эндпоинт
  // флудится произвольными paymentId. Порог с запасом над реальным трафиком ЮKassa.
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
    // Re-fetch перед действием — иначе подделанный canceled-вебхук мог бы
    // пометить чужую ожидающую покупку FAILED.
    const payment = await getPayment(paymentId).catch(() => null);
    if (payment?.status === 'canceled') {
      await failPurchaseByExternalId(paymentId);
    }
  }

  // Always return 200 so YooKassa doesn't retry on unknown events
  return NextResponse.json({ ok: true });
}
