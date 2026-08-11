import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/require-access';
import { trackExists } from '@vire/db';
import { isUuid } from '@/lib/upload';
import { analyzeGenreQueue } from '@/lib/queue';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const access = await requireAccess('admin.content.moderate');
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await analyzeGenreQueue.add({ trackId: id });
  await access.audit('track.analyze_genre', { type: 'track', id });
  return NextResponse.json({ queued: true }, { status: 202 });
}
