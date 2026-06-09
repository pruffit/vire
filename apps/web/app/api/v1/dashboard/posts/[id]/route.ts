import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  DrizzleArtistRepository,
  getArtistPostById,
  updateArtistPost,
  deleteArtistPost,
} from '@vire/db';

const TITLE_MAX = 120;
const BODY_MAX = 2000;

type Params = { params: Promise<{ id: string }> };

/** Проверяет вход (auth + владение постом), возвращает либо ошибку, либо ok. */
async function authorize(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized', status: 401 } as const;

  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) return { error: 'Artist profile not found', status: 403 } as const;

  const post = await getArtistPostById(id);
  if (!post) return { error: 'Not found', status: 404 } as const;
  if (post.artistProfileId !== artist.id) return { error: 'Forbidden', status: 403 } as const;

  return { ok: true as const };
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const gate = await authorize(id);
  if (!('ok' in gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const obj = (payload ?? {}) as Record<string, unknown>;
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : null;
  const body = typeof obj.body === 'string' ? obj.body.trim() : '';

  if (!body) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }
  if (body.length > BODY_MAX || (title && title.length > TITLE_MAX)) {
    return NextResponse.json({ error: 'Too long' }, { status: 400 });
  }

  await updateArtistPost(id, { title, body });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const gate = await authorize(id);
  if (!('ok' in gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  await deleteArtistPost(id);
  return NextResponse.json({ ok: true });
}
