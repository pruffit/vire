import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/require-access';
import { listTracksNeedingAnalysis } from '@vire/db';
import { analyzeQueue } from '@/lib/queue';

export async function POST() {
  const access = await requireAccess('admin.jobs.run');
  if (!access.ok) return access.response;

  const tracks = await listTracksNeedingAnalysis();
  await Promise.all(tracks.map((t) => analyzeQueue.add(t)));
  await access.audit('analysis.backfill', undefined, { queued: tracks.length });

  return NextResponse.json({ queued: tracks.length });
}
