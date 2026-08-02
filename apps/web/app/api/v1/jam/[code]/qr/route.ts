import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { jamService } from '@/lib/jam';
import { SITE_URL } from '@/lib/site';
import { PARTY_PATH } from '@/lib/party';
import { ValidationError } from '@vire/core';

type Ctx = { params: Promise<{ code: string }> };

/** Публичный QR — приглашение, без auth. Кодирует только ссылку комнаты, состояния не отдаёт. */
export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const codeResult = await jamService().resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }

  const base = codeResult.value.kind === 'PARTY' ? PARTY_PATH : '/jam';
  const svg = await QRCode.toString(`${SITE_URL}${base}/${codeResult.value.code}`, { type: 'svg' });
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
