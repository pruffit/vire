import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAudioFeaturesSnapshot } from '@vire/db';
import { isUuid } from '@/lib/upload';

const ADMIN_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.role || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const snapshot = await getAudioFeaturesSnapshot(id);
  return NextResponse.json(snapshot);
}
