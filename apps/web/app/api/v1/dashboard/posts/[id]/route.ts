import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistPostRepository } from '@vire/db';
import { ArtistPostService, NotFoundError, ValidationError } from '@vire/core';
import { getActiveArtist } from '@/lib/active-artist';

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
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (result.error instanceof ValidationError) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;
  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  const result = await service.delete(id, artist.id);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
