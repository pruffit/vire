import { notFound } from 'next/navigation';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { ReleaseEditForm } from './release-edit-form';

export const dynamic = 'force-dynamic';

export default async function AdminReleaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const release = await new DrizzleReleaseRepository(db).findById(id);
  if (!release) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <a href="/admin/releases" className="text-sm text-white/40 hover:text-white transition-colors">← Релизы</a>
        <h1 className="text-2xl font-semibold mt-2">Редактировать релиз</h1>
        <p className="text-xs text-white/30 font-mono mt-1">{release.id}</p>
      </div>
      <ReleaseEditForm
        releaseId={release.id}
        initial={{
          title: release.title,
          type: release.type,
          genre: release.genre,
          releaseDate: release.releaseDate ? release.releaseDate.toISOString().slice(0, 10) : '',
          description: release.description ?? '',
          linerNotes: release.linerNotes ?? '',
        }}
      />
    </div>
  );
}
