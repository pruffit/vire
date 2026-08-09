import { NextResponse } from 'next/server';
import { db, DrizzleArtistRepository } from '@vire/db';
import { ArtistService, NotFoundError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const service = new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() });
  const result = await service.getBySlug(slug);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(result.value);
}
