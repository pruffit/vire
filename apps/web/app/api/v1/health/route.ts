import { NextResponse } from 'next/server';
import { ping } from '@vire/db';

export async function GET() {
  try {
    await ping();
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'disconnected' },
      { status: 503 }
    );
  }
}
