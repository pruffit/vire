import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, COVER_POLICY } from '@/lib/image';
import { ALL_GENRES, type Genre, type ReleaseType } from '@vire/core';

const VALID_TYPES = new Set<ReleaseType>(['ALBUM', 'EP', 'SINGLE']);
const VALID_GENRES = new Set<string>(ALL_GENRES);

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

  const title = formData.get('title');
  const type = formData.get('type');
  const genreRaw = formData.get('genre');
  const releaseDateRaw = formData.get('releaseDate');
  const description = formData.get('description');
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

  const releaseId = crypto.randomUUID();
  let coverUrl: string | null = null;

  if (cover instanceof File && cover.size > 0) {
    const buffer = Buffer.from(await cover.arrayBuffer());
    const v = validateImageUpload(cover.size, buffer, COVER_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    coverUrl = await uploadToStream(`covers/${releaseId}.${v.info.ext}`, buffer, v.info.mime);
  }

  const releaseRepo = new DrizzleReleaseRepository(db);
  const release = await releaseRepo.create({
    id: releaseId,
    artistProfileId: artist.id,
    title: title.trim(),
    type: type as ReleaseType,
    genre,
    releaseDate,
    coverUrl,
    description:
      typeof description === 'string' && description.trim()
        ? description.trim()
        : null,
  });

  return NextResponse.json({ releaseId: release.id }, { status: 201 });
}
