import { NextResponse } from 'next/server';
import { getListeningNow } from '@/lib/listening-now';

/** Треки, которые слушают прямо сейчас (для live-секции на главной). */
export async function GET() {
  const tracks = await getListeningNow(6).catch(() => []);
  return NextResponse.json({ tracks });
}
