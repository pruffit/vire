import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, createArtistPost } from '@vire/db';

const TITLE_MAX = 120;
const BODY_MAX = 2000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, body } = normalize(payload);
  if (!body) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }
  if (body.length > BODY_MAX || (title && title.length > TITLE_MAX)) {
    return NextResponse.json({ error: 'Too long' }, { status: 400 });
  }

  const post = await createArtistPost({ artistProfileId: artist.id, title, body });
  return NextResponse.json({ post }, { status: 201 });
}

/** Достаёт и тримит title/body из произвольного JSON. */
export function normalize(payload: unknown): { title: string | null; body: string } {
  const obj = (payload ?? {}) as Record<string, unknown>;
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : null;
  const body = typeof obj.body === 'string' ? obj.body.trim() : '';
  return { title, body };
}
