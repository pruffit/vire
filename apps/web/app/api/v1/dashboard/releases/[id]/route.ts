import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { fileStorage } from '@/lib/file-storage';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, COVER_POLICY } from '@/lib/image';
import { ReleaseService, NotFoundError, ALL_GENRES, type Genre, type ReleaseType } from '@vire/core';
import { errorJson } from '@/lib/error-response';

const VALID_TYPES = new Set<ReleaseType>(['ALBUM', 'EP', 'SINGLE']);
const VALID_GENRES = new Set<string>(ALL_GENRES);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const title = formData.get('title');
  const type = formData.get('type');
  const genreRaw = formData.get('genre');
  const releaseDateRaw = formData.get('releaseDate');
  const description = formData.get('description');
  const linerNotes = formData.get('linerNotes');
  const cover = formData.get('cover');

  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (typeof type !== 'string' || !VALID_TYPES.has(type as ReleaseType)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (typeof genreRaw === 'string' && genreRaw && !VALID_GENRES.has(genreRaw)) {
    return NextResponse.json({ error: 'Invalid genre' }, { status: 400 });
  }
  const genre = typeof genreRaw === 'string' && genreRaw ? (genreRaw as Genre) : null;

  const releaseDate =
    typeof releaseDateRaw === 'string' && releaseDateRaw
      ? new Date(releaseDateRaw)
      : null;

  let coverInput: { buffer: Buffer; ext: string; mime: string } | undefined;
  if (cover instanceof File && cover.size > 0) {
    const buffer = Buffer.from(await cover.arrayBuffer());
    const v = validateImageUpload(cover.size, buffer, COVER_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    coverInput = { buffer, ext: v.info.ext, mime: v.info.mime };
  }

  const service = new ReleaseService(new DrizzleReleaseRepository(db), {
    uuid: () => crypto.randomUUID(),
    coverStorage: fileStorage,
  });
  const result = await service.update(id, artist.id, {
    title,
    type: type as ReleaseType,
    genre,
    releaseDate,
    description: typeof description === 'string' ? description : null,
    linerNotes: typeof linerNotes === 'string' ? linerNotes : null,
    cover: coverInput,
  });

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    return errorJson(result.error, 403);
  }

  return NextResponse.json({ releaseId: result.value.releaseId });
}

export async function DELETE(
  req: Request,
  { params }: Params,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;
  const service = new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() });
  const result = await service.deleteRelease({ releaseId: id, artistProfileId: artist.id });

  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true });
}
