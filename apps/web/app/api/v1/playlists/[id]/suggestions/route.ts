import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { NotFoundError } from '@vire/core';
import { playlistService } from '@/lib/playlist';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const result = await playlistService().suggestions(id, session.user.id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json(result.value);
}
