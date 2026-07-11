import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  getReleasePresaveInfo,
  presaveForUser,
  unpresaveForUser,
  presaveForGuest,
  getPresaveState,
} from '@vire/db';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ releaseId: string }> };

const guestSchema = z.object({ email: z.string().email().max(254) });

/** Пресейв доступен только для запланированного релиза с будущей датой выхода. */
function isPresavable(info: { status: string; releaseDate: Date | null }): boolean {
  return (
    info.status === 'SCHEDULED' &&
    info.releaseDate != null &&
    new Date(info.releaseDate).getTime() > Date.now()
  );
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ presaved: false });
  const { releaseId } = await params;
  const presaved = await getPresaveState(session.user.id, releaseId);
  return NextResponse.json({ presaved });
}

export async function POST(req: Request, { params }: Params) {
  const { releaseId } = await params;
  const info = await getReleasePresaveInfo(releaseId);
  if (!info) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isPresavable(info)) {
    return NextResponse.json(
      { error: 'Пресейв недоступен: релиз уже вышел или не запланирован' },
      { status: 400 },
    );
  }

  const session = await auth();

  if (session?.user?.id) {
    const rl = await rateLimit(`presave:${session.user.id}`, 30, 60);
    if (!rl.ok) return tooManyRequests(rl.retryAfter);
    await presaveForUser(session.user.id, releaseId);
    return NextResponse.json({ presaved: true });
  }

  // Гость: пресейв по email.
  const body = await req.json().catch(() => ({}));
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Нужен корректный email' }, { status: 400 });
  }

  // По IP отдельно от email-лимита: иначе гость спамит чужой ящик, каждый раз указывая новый email.
  const ipRl = await rateLimit(clientKey(req, 'presave-guest-ip'), 20, 3600);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);

  const email = parsed.data.email.trim().toLowerCase();
  const rl = await rateLimit(`presave-guest:${email}`, 10, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  await presaveForGuest(email, releaseId);
  return NextResponse.json({ presaved: true, guest: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { releaseId } = await params;
  await unpresaveForUser(session.user.id, releaseId);
  return NextResponse.json({ presaved: false });
}
