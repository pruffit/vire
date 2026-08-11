import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/require-access';
import { generateAllEditorialPlaylists } from '@vire/db';

export async function POST() {
  const access = await requireAccess('admin.jobs.run');
  if (!access.ok) return access.response;

  await generateAllEditorialPlaylists();
  await access.audit('editorial.generate');
  return NextResponse.json({ ok: true });
}
