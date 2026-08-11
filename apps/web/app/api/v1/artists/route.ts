import { NextResponse } from 'next/server';
import { DrizzleArtistCatalogRepository } from '@vire/db';
import { ArtistCatalogService } from '@vire/core';
import { artistCatalogQuerySchema, type ArtistCatalogResponse } from '@vire/api-contracts';

const HTTP_DEFAULT_LIMIT = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = artistCatalogQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  // Дефолт сервиса (200) рассчитан на страницу с клиентским фильтром; по HTTP отдаём
  // страницу того же размера, что максимум явного limit.
  const service = new ArtistCatalogService(new DrizzleArtistCatalogRepository());
  const view = await service.list({ ...parsed.data, limit: parsed.data.limit ?? HTTP_DEFAULT_LIMIT });

  const response: ArtistCatalogResponse = view;
  return NextResponse.json(response);
}
