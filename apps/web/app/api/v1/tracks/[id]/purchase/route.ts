import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  hasPurchasedTrack,
  getPendingPurchase,
  createPendingPurchase,
  trackExists,
  getTrackTitle,
} from '@vire/db';
import { isConfigured, createPayment, getPayment } from '@/lib/yookassa';

const TRACK_PRICE = '99.00';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: trackId } = await params;

  if (!(await trackExists(trackId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (await hasPurchasedTrack(session.user.id, trackId)) {
    return NextResponse.json({ ok: true, alreadyOwned: true });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: 'Платёжный сервис не настроен' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { returnUrl?: string };
  const returnUrl = body.returnUrl ?? `${APP_URL}/`;

  // Если уже есть незакрытый платёж, переиспользуем его
  const existing = await getPendingPurchase(session.user.id, trackId);
  if (existing) {
    const payment = await getPayment(existing.externalPaymentId).catch(() => null);
    if (payment?.confirmation?.confirmation_url) {
      return NextResponse.json({ confirmationUrl: payment.confirmation.confirmation_url });
    }
  }

  const trackTitle = await getTrackTitle(trackId) ?? trackId;
  const purchaseId = crypto.randomUUID();

  const payment = await createPayment({
    idempotencyKey: purchaseId,
    amount: TRACK_PRICE,
    description: `Трек: ${trackTitle}`,
    returnUrl,
    metadata: { purchaseId },
  });

  await createPendingPurchase({
    id: purchaseId,
    userId: session.user.id,
    trackId,
    price: TRACK_PRICE,
    externalPaymentId: payment.id,
    paymentProvider: 'yookassa',
  });

  return NextResponse.json({ confirmationUrl: payment.confirmation.confirmation_url });
}
