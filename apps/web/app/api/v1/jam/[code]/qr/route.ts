import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { jamService } from '@/lib/jam';
import { SITE_URL } from '@/lib/site';
import { ValidationError } from '@vire/core';

type Ctx = { params: Promise<{ code: string }> };

/** Публичный QR — приглашение, без auth. Кодирует только ссылку /jam/{code}, состояния не отдаёт. */
export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const codeResult = await jamService().resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }

  const svg = await QRCode.toString(`${SITE_URL}/jam/${codeResult.value.code}`, { type: 'svg' });
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
