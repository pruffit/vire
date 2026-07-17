import { notFound } from 'next/navigation';
import { getArtistCore } from '@vire/db';
import { ArtistEditForm } from './artist-edit-form';
import { DetailHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminArtistEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = await getArtistCore(id);
  if (!artist) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <DetailHeader backHref="/admin/artists" backLabel="Артисты" title="Редактировать артиста" subtitle={artist.id} />
      <ArtistEditForm
        artistProfileId={artist.id}
        initial={{
          name: artist.name,
          slug: artist.slug,
          bio: artist.bio ?? '',
          avatarUrl: artist.avatarUrl ?? '',
        }}
        initialTheme={artist.themeTokens}
      />
    </div>
  );
}
