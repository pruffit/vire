import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listTracksNeedingAnalysis } from '@vire/db';
import { analyzeQueue } from '@/lib/queue';

export async function POST() {
  const session = await auth();
  const role = session?.user?.role;
  // Read-only VIEWER: тихий no-op (без запуска работы), чтобы кнопка не показывала «Ошибка».
  if (role === 'VIEWER') {
    return NextResponse.json({ queued: 0 });
  }
  if (!role || !['ADMIN', 'SUPERADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tracks = await listTracksNeedingAnalysis();
  await Promise.all(tracks.map((t) => analyzeQueue.add(t)));

  return NextResponse.json({ queued: tracks.length });
}
