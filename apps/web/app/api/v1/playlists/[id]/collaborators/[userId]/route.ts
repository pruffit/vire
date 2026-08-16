import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { NotFoundError } from '@vire/core';
import type { OkResponse } from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, userId } = await params;
  const result = await playlistService().kick(id, caller.id, userId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
