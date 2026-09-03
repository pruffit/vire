import { NextResponse } from 'next/server';
import {
  getTrackArtistProfileId,
  getArtistContext,
  artistHasPublishedTrackById,
  isArtistMember,
  getFollowerCount,
} from '@vire/db';
import { isUuid } from '@vire/core';
import { getCaller } from '@/lib/caller';
import { canViewEmptyArtist } from '@/lib/artist-visibility';
import { buildSimilarArtists } from '@/lib/discovery';
import type { TrackContextResponse } from '@vire/api-contracts';

type Params = { params: Promise<{ id: string }> };

/** Артист трека и похожие артисты — для «Об авторе»/«Похожие» в мобильном плеере. */
export async function GET(_req: Request, { params }: Params) {
  const { id: trackId } = await params;
  if (!isUuid(trackId)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const artistProfileId = await getTrackArtistProfileId(trackId);
  if (!artistProfileId) return NextResponse.json({ error: 'Track not found' }, { status: 404 });

  const artist = await getArtistContext(artistProfileId);
  if (!artist) return NextResponse.json({ error: 'Track not found' }, { status: 404 });

  // Тот же гейт видимости, что у /api/v1/artists/[slug]: пустой артист скрыт от всех, кроме своих/стаффа.
  if (!(await artistHasPublishedTrackById(artistProfileId))) {
    const caller = await getCaller();
    const isMember = caller ? await isArtistMember(artistProfileId, caller.id) : false;
    if (!canViewEmptyArtist({ isMember, role: caller?.role ?? null })) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
  }

  const [similar, followerCount] = await Promise.all([
    buildSimilarArtists(artistProfileId),
    getFollowerCount(artistProfileId),
  ]);

  return NextResponse.json({
    artist: {
      slug: artist.slug,
      name: artist.name,
      avatarUrl: artist.avatarUrl,
      bio: artist.bio,
      accentColor: artist.accentColor,
      followerCount,
    },
    similar: similar.map((a) => ({ slug: a.artistSlug, name: a.artistName, avatarUrl: a.artistAvatarUrl })),
  } satisfies TrackContextResponse);
}
