import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listTracksNeedingAnalysis } from '@vire/db';
import { analyzeQueue } from '@/lib/queue';

export async function POST() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !['ADMIN', 'SUPERADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tracks = await listTracksNeedingAnalysis();
  await Promise.all(tracks.map((t) => analyzeQueue.add(t)));

  return NextResponse.json({ queued: tracks.length });
}
