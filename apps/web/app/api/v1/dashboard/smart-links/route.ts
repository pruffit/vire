import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleSmartLinkRepository } from '@vire/db';
import { SmartLinkService, ConflictError } from '@vire/core';
import { fileStorage } from '@/lib/file-storage';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, COVER_POLICY } from '@/lib/image';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const cover = formData.get('cover');
  let coverInput: { buffer: Buffer; ext: string; mime: string } | null = null;
  if (cover instanceof File && cover.size > 0) {
    const buffer = Buffer.from(await cover.arrayBuffer());
    const v = validateImageUpload(cover.size, buffer, COVER_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    coverInput = { buffer, ext: v.info.ext, mime: v.info.mime };
  }

  const service = new SmartLinkService(new DrizzleSmartLinkRepository(db), { coverStorage: fileStorage });
  const result = await service.create(artist.id, {
    title: formData.get('title'),
    slugRaw: formData.get('slug'),
    subtitle: formData.get('subtitle'),
    releaseDateRaw: formData.get('releaseDate'),
    releaseIdRaw: formData.get('releaseId'),
    linksRaw: formData.get('links'),
    isPublished: formData.get('isPublished') === '1',
    cover: coverInput,
  });

  if (!result.ok) {
    if (result.error instanceof ConflictError) {
      return NextResponse.json({ error: result.error.message }, { status: 409 });
    }
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ id: result.value.id, slug: result.value.slug }, { status: 201 });
}
