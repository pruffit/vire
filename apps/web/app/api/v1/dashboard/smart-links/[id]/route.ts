import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleSmartLinkRepository } from '@vire/db';
import { SmartLinkService, NotFoundError, ConflictError } from '@vire/core';
import { fileStorage } from '@/lib/file-storage';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, COVER_POLICY } from '@/lib/image';
import { errorJson } from '@/lib/error-response';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
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

  const service = new SmartLinkService(new DrizzleSmartLinkRepository(db), {
    uuid: () => crypto.randomUUID(),
    coverStorage: fileStorage,
  });
  const result = await service.update(id, artist.id, {
    title: formData.get('title'),
    slugRaw: formData.get('slug'),
    subtitle: formData.get('subtitle'),
    releaseDateRaw: formData.get('releaseDate'),
    releaseIdRaw: formData.get('releaseId'),
    linksPresent: formData.get('links') !== null,
    linksRaw: formData.get('links'),
    isPublishedRaw: formData.get('isPublished'),
    cover: coverInput,
    removeCover: formData.get('removeCover') === '1',
  });

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    if (result.error instanceof ConflictError) {
      return errorJson(result.error, 409);
    }
    return errorJson(result.error, 400);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const service = new SmartLinkService(new DrizzleSmartLinkRepository(db), { uuid: () => crypto.randomUUID() });
  const result = await service.delete(id, artist.id);
  if (!result.ok) {
    return errorJson(result.error, 404);
  }
  return NextResponse.json({ ok: true });
}
