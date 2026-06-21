import { notFound } from 'next/navigation';
import { getArtistCore } from '@vire/db';
import { ArtistEditForm } from './artist-edit-form';

export const dynamic = 'force-dynamic';

export default async function AdminArtistEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = await getArtistCore(id);
  if (!artist) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <a href="/admin/artists" className="text-sm text-white/40 hover:text-white transition-colors">← Артисты</a>
        <h1 className="text-2xl font-semibold mt-2">Редактировать артиста</h1>
        <p className="text-xs text-white/30 font-mono mt-1">{artist.id}</p>
      </div>
      <ArtistEditForm
        artistProfileId={artist.id}
        initial={{
          name: artist.name,
          slug: artist.slug,
          bio: artist.bio ?? '',
          avatarUrl: artist.avatarUrl ?? '',
        }}
      />
    </div>
  );
}
