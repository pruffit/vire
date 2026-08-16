import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { upsertPushSubscription, deletePushSubscription } from '@vire/db';
import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  type OkResponse,
} from '@vire/api-contracts';

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.VAPID_PUBLIC_KEY) return NextResponse.json({ error: 'Push disabled' }, { status: 503 });

  const parsed = pushSubscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

  await upsertPushSubscription(caller.id, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

export async function DELETE(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = pushUnsubscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });

  await deletePushSubscription(caller.id, parsed.data.endpoint);
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
