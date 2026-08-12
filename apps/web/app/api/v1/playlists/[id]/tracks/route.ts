import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { NotFoundError, ConflictError } from '@vire/core';
import {
  addPlaylistTrackSchema,
  reorderPlaylistTracksSchema,
  type PlaylistTracksResponse,
  type OkResponse,
} from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  const token = new URL(req.url).searchParams.get('token') ?? undefined;

  const result = await playlistService().getForViewer(id, session?.user?.id ?? null, token);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({
    tracks: result.value.tracks,
    version: result.value.version,
  } satisfies PlaylistTracksResponse);
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = reorderPlaylistTracksSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().reorder(id, session.user.id, parsed.data.trackIds);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (result.error instanceof ConflictError) return NextResponse.json({ error: 'Reorder conflict' }, { status: 409 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

function addTrackErrorText(error: NotFoundError): string {
  return error.resource === 'Track' ? 'Track not found' : 'Not found';
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`playlist-track-add:${session.user.id}`, 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addPlaylistTrackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().addTrack(id, session.user.id, parsed.data.trackId);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: addTrackErrorText(result.error) }, { status: 404 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
