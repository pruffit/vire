import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { notificationService } from '@/lib/notifications';
import type { OkResponse } from '@vire/api-contracts';

export async function POST() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await notificationService().markAllRead(caller.id);
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
