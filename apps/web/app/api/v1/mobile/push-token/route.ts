import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { upsertExpoPushToken, deleteExpoPushToken } from '@vire/db';
import {
  expoPushTokenSchema,
  expoPushUnregisterSchema,
  type OkResponse,
} from '@vire/api-contracts';

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = expoPushTokenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

  await upsertExpoPushToken(caller.id, {
    token: parsed.data.token,
    platform: parsed.data.platform,
    deviceId: parsed.data.deviceId,
  });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

export async function DELETE(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = expoPushUnregisterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

  await deleteExpoPushToken(caller.id, parsed.data.token);
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
