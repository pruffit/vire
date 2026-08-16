import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { composeHomeScreen } from '@vire/core';
import { screenSchema, type Screen } from '@vire/api-contracts';

// Клиент объявляет, что умеет рендерить: сервер не отдаёт типы, которых тот не знает
// (docs/sdui.md §5). Веб заголовок не шлёт — получает полную композицию.
function supportedBlocks(req: Request): string[] {
  const header = req.headers.get('x-vire-blocks');
  if (!header) return [];
  return header.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: Request) {
  const caller = await getCaller();
  const screen = composeHomeScreen({
    isAuthenticated: Boolean(caller),
    supportedBlocks: supportedBlocks(req),
  });

  return NextResponse.json(screenSchema.parse(screen) satisfies Screen, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
