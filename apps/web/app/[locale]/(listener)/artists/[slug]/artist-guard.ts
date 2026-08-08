import { cache } from 'react';
import { notFound } from 'next/navigation';
import { db, DrizzleArtistRepository, artistHasPublishedTrackById, isArtistMember } from '@vire/db';
import { ArtistService, type ArtistProfile } from '@vire/core';
import { auth } from '@/auth';
import { canViewEmptyArtist } from '@/lib/artist-visibility';

// Один загрузчик артиста на весь сегмент: layout, страница артиста, релиз и трек читают его
// отсюда — cache() схлопывает это в один запрос за рендер.
export const getArtist = cache(async (slug: string): Promise<ArtistProfile | null> => {
  const result = await new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() }).getBySlug(slug);
  return result.ok ? result.value : null;
});

// пустой артист скрыт с витрины (каталог/поиск/sitemap) — прямой заход должен отвечать так же
export const assertArtistVisible = cache(async (artistProfileId: string): Promise<void> => {
  if (await artistHasPublishedTrackById(artistProfileId)) return;
  const session = await auth();
  const userId = session?.user?.id;
  const isMember = userId ? await isArtistMember(artistProfileId, userId) : false;
  if (!canViewEmptyArtist({ isMember, role: session?.user?.role })) notFound();
});

// Гейт живёт в layout.tsx — он рендерится ДО Suspense-границы вложенных сегментов, а notFound()
// из уже застриминного поддерева HTTP-статус ответа поменять не может (см. TODO.md — soft-404).
export const assertArtistExists = cache(async (slug: string): Promise<ArtistProfile> => {
  const artist = await getArtist(slug);
  if (!artist) notFound();
  await assertArtistVisible(artist.id);
  return artist;
});
