import { NextResponse } from 'next/server';
import { getCaller, clearDeviceStateCache } from '@/lib/caller';
import { deviceAuthService } from '@/lib/device-auth';
import { errorJson } from '@/lib/error-response';
import { isUuid } from '@/lib/upload';
import type { OkResponse } from '@vire/api-contracts';

/** Отзыв устройства: access перестаёт приниматься в пределах TTL кэша состояния (30 с). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deviceId } = await params;
  if (!isUuid(deviceId)) return NextResponse.json({ error: 'Invalid device id' }, { status: 400 });

  const result = await deviceAuthService().revoke({ userId: caller.id, deviceId });
  if (!result.ok) return errorJson(result.error, 404);

  clearDeviceStateCache();
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
