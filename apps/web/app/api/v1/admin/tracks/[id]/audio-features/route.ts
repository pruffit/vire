import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/require-access';
import { getAudioFeaturesSnapshot } from '@vire/db';
import { isUuid } from '@/lib/upload';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const access = await requireAccess('admin.read');
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const snapshot = await getAudioFeaturesSnapshot(id);
  return NextResponse.json(snapshot);
}
