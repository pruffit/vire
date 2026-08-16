import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { jamService } from '@/lib/jam';
import { ForbiddenError, ValidationError } from '@vire/core';
import { playlistService } from '@/lib/playlist';
import { errorJson } from '@/lib/error-response';

const schema = z.object({ title: z.string().trim().min(1).max(100).optional() });

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { code } = await params;
  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }

  const saveResult = await service.getQueueForSave(codeResult.value.id, { userId: caller.id });
  if (!saveResult.ok) {
    const status = saveResult.error instanceof ForbiddenError ? 403 : 404;
    return errorJson(saveResult.error, status);
  }

  const { session: jam, isHost, queue } = saveResult.value;
  const vireItems = queue.filter((item): item is typeof item & { trackId: string } => item.source === 'VIRE' && item.trackId !== null);
  if (vireItems.length === 0) {
    // Плейлист ссылается на треки каталога — YouTube/SoundCloud/файлы с устройства в него не кладутся.
    const error = queue.length > 0
      ? 'В очереди нет треков из каталога VireMusic — сохранить можно только их'
      : 'Очередь пуста';
    return NextResponse.json({ error }, { status: 400 });
  }

  const title = parsed.data.title ?? jam.title ?? `Джем ${new Date().toLocaleDateString('ru-RU')}`;

  const plSvc = playlistService();
  const created = await plSvc.create(caller.id, title);
  if (!created.ok) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const playlistId = created.value.id;
  for (const item of vireItems) {
    await plSvc.addTrack(playlistId, caller.id, item.trackId);
  }

  if (isHost) await service.recordSavedPlaylist(codeResult.value.id, playlistId);

  return NextResponse.json({ playlistId }, { status: 201 });
}
