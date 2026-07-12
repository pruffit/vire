import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistPostRepository } from '@vire/db';
import { ArtistPostService } from '@vire/core';
import { getActiveArtist } from '@/lib/active-artist';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  const result = await service.create(artist.id, payload);

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ post: result.value.post }, { status: 201 });
}
