import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzlePurchaseRepository } from '@vire/db';
import { PurchaseService, NotFoundError } from '@vire/core';
import { isConfigured } from '@/lib/yookassa';
import { YookassaPaymentGateway } from '@/lib/payment-gateway';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type Params = { params: Promise<{ id: string }> };

function purchaseService(): PurchaseService {
  return new PurchaseService(new DrizzlePurchaseRepository(db), new YookassaPaymentGateway(), {
    idGen: () => crypto.randomUUID(),
  });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: trackId } = await params;

  if (!isConfigured()) {
    return NextResponse.json({ error: 'Платёжный сервис не настроен' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { returnUrl?: string };
  const returnUrl = body.returnUrl ?? `${APP_URL}/`;

  const result = await purchaseService().purchase(session.user.id, trackId, returnUrl);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  if ('alreadyOwned' in result.value) {
    return NextResponse.json({ ok: true, alreadyOwned: true });
  }
  return NextResponse.json({ confirmationUrl: result.value.confirmationUrl });
}
