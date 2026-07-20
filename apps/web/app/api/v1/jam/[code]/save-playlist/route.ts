import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { jamService } from '@/lib/jam';
import { db, DrizzlePlaylistRepository } from '@vire/db';
import { PlaylistService, ForbiddenError, ValidationError } from '@vire/core';
import { playlistCoverStorage } from '@/lib/playlist-cover-storage';

const schema = z.object({ title: z.string().trim().min(1).max(100).optional() });

function playlistService() {
  return new PlaylistService(new DrizzlePlaylistRepository(db), playlistCoverStorage, Date.now);
}

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { code } = await params;
  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }

  const saveResult = await service.getQueueForSave(codeResult.value.id, { userId: session.user.id });
  if (!saveResult.ok) {
    const status = saveResult.error instanceof ForbiddenError ? 403 : 404;
    return NextResponse.json({ error: saveResult.error.message }, { status });
  }

  const { session: jam, isHost, queue } = saveResult.value;
  if (queue.length === 0) return NextResponse.json({ error: 'Очередь пуста' }, { status: 400 });

  const title = parsed.data.title ?? jam.title ?? `Джем ${new Date().toLocaleDateString('ru-RU')}`;

  const plSvc = playlistService();
  const created = await plSvc.create(session.user.id, title);
  if (!created.ok) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const playlistId = created.value.id;
  for (const item of queue) {
    await plSvc.addTrack(playlistId, session.user.id, item.trackId);
  }

  if (isHost) await service.recordSavedPlaylist(codeResult.value.id, playlistId);

  return NextResponse.json({ playlistId }, { status: 201 });
}
