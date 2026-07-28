import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { NotFoundError, type PlaylistUpdatePatch } from '@vire/core';
import { playlistService } from '@/lib/playlist';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();

  const result = await playlistService().getForViewer(id, session?.user?.id ?? null);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ playlist: result.value });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const patch: PlaylistUpdatePatch = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility;

  const result = await playlistService().update(id, session.user.id, patch);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().delete(id, session.user.id);
  if (!result.ok) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
