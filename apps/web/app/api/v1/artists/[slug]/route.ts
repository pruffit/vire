import { NextResponse } from 'next/server';
import { db, DrizzleArtistRepository, isArtistMember } from '@vire/db';
import { ArtistService, NotFoundError, type ArtistProfile } from '@vire/core';
import type { ArtistDetailResponse } from '@vire/api-contracts';
import { getCaller } from '@/lib/caller';
import { canViewEmptyArtist } from '@/lib/artist-visibility';
import { artistHasPublishedTrack } from '@/lib/artist-page';
import { errorJson } from '@/lib/error-response';

function toResponse(artist: ArtistProfile): ArtistDetailResponse {
  return {
    ...artist,
    createdAt: artist.createdAt.toISOString(),
    updatedAt: artist.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const service = new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() });
  const result = await service.getBySlug(slug);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const artist = result.value;

  // Пустой артист скрыт с витрины (каталог/поиск/sitemap) — этот ресурсный роут должен
  // отвечать так же, тем же 404, что и отсутствующий артист (см. TODO.md, тот же гейт,
  // что apps/web/app/[locale]/(listener)/artists/[slug]/artist-guard.ts::assertArtistVisible).
  if (!(await artistHasPublishedTrack(artist.id))) {
    const caller = await getCaller();
    const isMember = caller ? await isArtistMember(artist.id, caller.id) : false;
    if (!canViewEmptyArtist({ isMember, role: caller?.role ?? null })) {
      return errorJson(new NotFoundError('ArtistProfile', slug, 'artist.notFound'), 404);
    }
  }

  return NextResponse.json(toResponse(artist));
}
