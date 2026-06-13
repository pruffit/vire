import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import { validateImageUpload, COVER_POLICY } from '@/lib/image';
import { ReleaseService, NotFoundError, ALL_GENRES, type Genre, type ReleaseType } from '@vire/core';

const VALID_TYPES = new Set<ReleaseType>(['ALBUM', 'EP', 'SINGLE']);
const VALID_GENRES = new Set<string>(ALL_GENRES);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artistRepo = new DrizzleArtistRepository(db);
  const artist = await artistRepo.findByUserId(session.user.id);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;
  const releaseRepo = new DrizzleReleaseRepository(db);
  const release = await releaseRepo.findById(id);

  if (!release) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (release.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  let coverUrl = release.coverUrl;
  if (cover instanceof File && cover.size > 0) {
    const buffer = Buffer.from(await cover.arrayBuffer());
    const v = validateImageUpload(cover.size, buffer, COVER_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    coverUrl = await uploadToStream(`covers/${id}.${v.info.ext}`, buffer, v.info.mime);
  }

  const updated = await releaseRepo.update(id, {
    title: title.trim(),
    type: type as ReleaseType,
    genre,
    releaseDate,
    coverUrl,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    linerNotes: typeof linerNotes === 'string' && linerNotes.trim() ? linerNotes.trim() : null,
  });

  return NextResponse.json({ releaseId: updated.id });
}

export async function DELETE(
  _req: Request,
  { params }: Params,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;
  const service = new ReleaseService(new DrizzleReleaseRepository(db));
  const result = await service.deleteRelease({ releaseId: id, artistProfileId: artist.id });

  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
