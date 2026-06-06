import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasPurchasedTrack, createTrackPurchase, trackExists } from '@vire/db';

const TRACK_PRICE = '99.00';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: trackId } = await params;

  if (!(await trackExists(trackId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Idempotent — already purchased
  if (await hasPurchasedTrack(session.user.id, trackId)) {
    return NextResponse.json({ ok: true, alreadyOwned: true });
  }

  await createTrackPurchase(session.user.id, trackId, TRACK_PRICE);

  return NextResponse.json({ ok: true, alreadyOwned: false });
}
