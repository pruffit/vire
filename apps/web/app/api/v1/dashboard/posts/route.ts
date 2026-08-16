import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { db, DrizzleArtistPostRepository } from '@vire/db';
import { ArtistPostService } from '@vire/core';
import { getActiveArtist } from '@/lib/active-artist';
import { errorJson } from '@/lib/error-response';

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(caller.id, req);
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
    return errorJson(result.error, 400);
  }

  return NextResponse.json({ post: result.value.post }, { status: 201 });
}
