import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateAllEditorialPlaylists } from '@vire/db';

export async function POST() {
  const session = await auth();
  const role = session?.user?.role;
  // Read-only VIEWER: тихий no-op (без генерации), чтобы кнопка не показывала «Ошибка».
  if (role === 'VIEWER') {
    return NextResponse.json({ ok: true });
  }
  if (!role || !['ADMIN', 'SUPERADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await generateAllEditorialPlaylists();
  return NextResponse.json({ ok: true });
}
