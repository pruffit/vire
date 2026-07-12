import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzlePlaylistRepository } from '@vire/db';
import { PlaylistService, NotFoundError } from '@vire/core';
import { playlistCoverStorage } from '@/lib/playlist-cover-storage';
import { validateImageUpload, PLAYLIST_COVER_POLICY } from '@/lib/image';

type Params = { params: Promise<{ id: string }> };

function playlistService() {
  return new PlaylistService(new DrizzlePlaylistRepository(db), playlistCoverStorage, Date.now);
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

  if (formData.get('removeCover') === '1') {
    const result = await playlistService().setCover(id, session.user.id, null);
    if (!result.ok) {
      const status = result.error instanceof NotFoundError ? 404 : 403;
      return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
    }
    return NextResponse.json({ ok: true, coverUrl: null });
  }

  const file = formData.get('cover');
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: 'No file' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const v = validateImageUpload(file.size, buffer, PLAYLIST_COVER_POLICY);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const result = await playlistService().setCover(id, session.user.id, { buffer, contentType: v.info.mime, ext: v.info.ext });
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ ok: true, coverUrl: result.value });
}
