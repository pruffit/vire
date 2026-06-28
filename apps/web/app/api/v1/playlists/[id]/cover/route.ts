import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPlaylistWithTracks, setPlaylistCover } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import { validateImageUpload, PLAYLIST_COVER_POLICY } from '@/lib/image';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (playlist.ownerUserId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

  if (formData.get('removeCover') === '1') {
    await setPlaylistCover(id, session.user.id, null);
    return NextResponse.json({ ok: true, coverUrl: null });
  }

  const file = formData.get('cover');
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: 'No file' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const v = validateImageUpload(file.size, buffer, PLAYLIST_COVER_POLICY);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const url = await uploadToStream(`playlists/${id}.${v.info.ext}`, buffer, v.info.mime);
  const coverUrl = `${url}?v=${Date.now()}`;
  await setPlaylistCover(id, session.user.id, coverUrl);
  return NextResponse.json({ ok: true, coverUrl });
}
