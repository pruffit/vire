import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { updateUserName } from '@vire/db';

const schema = z.object({
  name: z.string().min(1).max(50),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

  const name = parsed.data.name.trim();
  await updateUserName(session.user.id, name);

  return NextResponse.json({ ok: true, name });
}
