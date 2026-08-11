import { NextResponse } from 'next/server';
import { DrizzleReleaseCatalogRepository } from '@vire/db';
import { ReleaseCatalogService, type ReleaseCatalogView } from '@vire/core';
import { releaseCatalogQuerySchema, type ReleaseCatalogResponse } from '@vire/api-contracts';

function toResponse(view: ReleaseCatalogView): ReleaseCatalogResponse {
  return {
    items: view.items.map((r) => ({
      ...r,
      releaseDate: r.releaseDate?.toISOString() ?? null,
    })),
    hasMore: view.hasMore,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = releaseCatalogQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const service = new ReleaseCatalogService(new DrizzleReleaseCatalogRepository());
  const view = await service.list(parsed.data);

  return NextResponse.json(toResponse(view));
}
