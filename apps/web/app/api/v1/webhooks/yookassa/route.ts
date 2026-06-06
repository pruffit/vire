import { NextResponse } from 'next/server';
import { confirmPurchaseByExternalId, failPurchaseByExternalId } from '@vire/db';
import { getPayment } from '@/lib/yookassa';

// YooKassa sends webhooks for payment.succeeded and payment.canceled events.
// We verify each event by re-fetching the payment from the API before acting.
export async function POST(req: Request) {
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
    await failPurchaseByExternalId(paymentId);
  }

  // Always return 200 so YooKassa doesn't retry on unknown events
  return NextResponse.json({ ok: true });
}
