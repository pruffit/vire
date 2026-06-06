import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import type { ReleaseType } from '@vire/core';

const VALID_TYPES = new Set<ReleaseType>(['ALBUM', 'EP', 'SINGLE']);
const COVER_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artistRepo = new DrizzleArtistRepository(db);
  const artist = await artistRepo.findByUserId(session.user.id);
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
  const releaseDateRaw = formData.get('releaseDate');
  const description = formData.get('description');
  const cover = formData.get('cover');

  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (typeof type !== 'string' || !VALID_TYPES.has(type as ReleaseType)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const releaseDate =
    typeof releaseDateRaw === 'string' && releaseDateRaw
      ? new Date(releaseDateRaw)
      : null;

  const releaseId = crypto.randomUUID();
  let coverUrl: string | null = null;

  if (cover instanceof File && cover.size > 0) {
    const ext = COVER_MIME[cover.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Cover must be JPEG, PNG or WebP' },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await cover.arrayBuffer());
    coverUrl = await uploadToStream(`covers/${releaseId}.${ext}`, buffer, cover.type);
  }

  const releaseRepo = new DrizzleReleaseRepository(db);
  const release = await releaseRepo.create({
    id: releaseId,
    artistProfileId: artist.id,
    title: title.trim(),
    type: type as ReleaseType,
    releaseDate,
    coverUrl,
    description:
      typeof description === 'string' && description.trim()
        ? description.trim()
        : null,
  });

  return NextResponse.json({ releaseId: release.id }, { status: 201 });
}
