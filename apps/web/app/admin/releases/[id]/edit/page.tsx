import { notFound } from 'next/navigation';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { ReleaseEditForm } from './release-edit-form';
import { DetailHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminReleaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const release = await new DrizzleReleaseRepository(db).findById(id);
  if (!release) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <DetailHeader backHref="/admin/releases" backLabel="Релизы" title="Редактировать релиз" subtitle={release.id} />
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
