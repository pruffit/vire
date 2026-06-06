import { NextResponse } from 'next/server';
import { searchAll } from '@vire/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ artists: [], releases: [], tracks: [] });
  }

  const results = await searchAll(q, 4);
  return NextResponse.json(results);
}
