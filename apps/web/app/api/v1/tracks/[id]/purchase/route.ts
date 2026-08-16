import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { db, DrizzlePurchaseRepository } from '@vire/db';
import { PurchaseService, NotFoundError, ValidationError } from '@vire/core';
import { YookassaPaymentGateway } from '@/lib/payment-gateway';
import { errorJson } from '@/lib/error-response';
import type { PurchaseResponse } from '@vire/api-contracts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type Params = { params: Promise<{ id: string }> };

function purchaseService(): PurchaseService {
  return new PurchaseService(new DrizzlePurchaseRepository(db), new YookassaPaymentGateway(), {
    idGen: () => crypto.randomUUID(),
  });
}

export async function POST(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: trackId } = await params;

  const body = await req.json().catch(() => ({})) as { returnUrl?: string };
  const returnUrl = body.returnUrl ?? `${APP_URL}/`;

  const result = await purchaseService().purchase(caller.id, trackId, returnUrl);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    if (result.error instanceof ValidationError) {
      return errorJson(result.error, 503);
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  if ('alreadyOwned' in result.value) {
    return NextResponse.json({ ok: true, alreadyOwned: true } satisfies PurchaseResponse);
  }
  // Провайдер не дал ссылку на оплату — платить негде; для клиента это тот же сбой оплаты,
  // что и недоступный провайдер, а не успех с пустым полем.
  if (!result.value.confirmationUrl) {
    return NextResponse.json({ error: 'Payment provider unavailable' }, { status: 503 });
  }
  return NextResponse.json({ confirmationUrl: result.value.confirmationUrl } satisfies PurchaseResponse);
}
