import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { trackExists, getTrackSourceKey } from '@vire/db';
import { isUuid } from '@/lib/upload';
import { analyzeQueue } from '@/lib/queue';

const ADMIN_MUTATE_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.role || !ADMIN_MUTATE_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const flacKey = await getTrackSourceKey(id);
  if (!flacKey) return NextResponse.json({ error: 'No source file' }, { status: 409 });

  await analyzeQueue.add({ trackId: id, flacKey });
  return NextResponse.json({ queued: true }, { status: 202 });
}
