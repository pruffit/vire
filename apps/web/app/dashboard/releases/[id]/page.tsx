import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { EditReleaseForm } from './edit-release-form';
import { AddTrackForm } from './add-track-form';
import { TrackManager } from './track-manager';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditReleasePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard');

  const { id } = await params;

  const artistRepo = new DrizzleArtistRepository(db);
  const artist = await artistRepo.findByUserId(session.user.id);
  if (!artist) redirect('/dashboard');

  const releaseRepo = new DrizzleReleaseRepository(db);
  const data = await releaseRepo.findWithTracks(id);
  if (!data) notFound();
  if (data.release.artistProfileId !== artist.id) notFound();

  const { release, tracks } = data;

  return (
    <div className="min-h-full bg-[#0d0d0d] text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <a
            href="/dashboard"
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            ← Назад
          </a>
          <h1 className="text-2xl font-semibold">Редактировать релиз</h1>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <EditReleaseForm
            releaseId={release.id}
            initial={{
              title: release.title,
              type: release.type,
              releaseDate: release.releaseDate?.toISOString().slice(0, 10) ?? '',
              description: release.description ?? '',
              linerNotes: release.linerNotes ?? '',
              coverUrl: release.coverUrl ?? null,
            }}
          />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            Треки
            <span className="ml-2 text-sm text-white/30 font-normal">{tracks.length}</span>
          </h2>

          <TrackManager
            key={tracks.map((t) => t.id).join('-')}
            initial={tracks.map((t) => ({
              id: t.id,
              title: t.title,
              trackNumber: t.trackNumber,
              status: t.status,
            }))}
          />

          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <p className="text-sm font-medium mb-4">Добавить трек</p>
            <AddTrackForm releaseId={release.id} nextTrackNumber={tracks.length + 1} />
          </div>
        </section>
      </div>
    </div>
  );
}
