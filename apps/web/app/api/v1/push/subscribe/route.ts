import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { upsertPushSubscription, deletePushSubscription } from '@vire/db';

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.VAPID_PUBLIC_KEY) return NextResponse.json({ error: 'Push disabled' }, { status: 503 });

  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

  await upsertPushSubscription(caller.id, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  await deletePushSubscription(caller.id, parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
