import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { db, DrizzleArtistPostRepository } from '@vire/db';
import { ArtistPostService, NotFoundError, ValidationError } from '@vire/core';
import { getActiveArtist } from '@/lib/active-artist';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(caller.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  const result = await service.update(id, artist.id, payload);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    if (result.error instanceof ValidationError) {
      return errorJson(result.error, 400);
    }
    return errorJson(result.error, 403);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(caller.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;
  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  const result = await service.delete(id, artist.id);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    return errorJson(result.error, 403);
  }

  return NextResponse.json({ ok: true });
}
