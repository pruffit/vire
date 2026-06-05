import { NextResponse } from 'next/server';
import { getHlsManifestKey } from '@vire/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const key = await getHlsManifestKey(id);

  if (!key) {
    return NextResponse.json({ error: 'No audio available' }, { status: 404 });
  }

  const base = process.env.STORAGE_PUBLIC_URL ?? '';
  return NextResponse.json({ hlsUrl: `${base}/${key}` });
}
