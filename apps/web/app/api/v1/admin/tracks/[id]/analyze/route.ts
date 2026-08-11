import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/require-access';
import { trackExists, getTrackSourceKey } from '@vire/db';
import { isUuid } from '@/lib/upload';
import { analyzeQueue } from '@/lib/queue';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const access = await requireAccess('admin.content.moderate');
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const flacKey = await getTrackSourceKey(id);
  if (!flacKey) return NextResponse.json({ error: 'No source file' }, { status: 409 });

  await analyzeQueue.add({ trackId: id, flacKey });
  await access.audit('track.analyze', { type: 'track', id });
  return NextResponse.json({ queued: true }, { status: 202 });
}
