import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { EditReleaseForm } from './edit-release-form';
import { AddTrackForm } from './add-track-form';

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

          {tracks.length > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5">
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-6 text-right text-white/30 shrink-0 font-mono text-xs">
                    {track.trackNumber}
                  </span>
                  <span className="flex-1 truncate">{track.title}</span>
                  <span className={`text-xs font-mono shrink-0 ${
                    track.status === 'READY' ? 'text-green-400'
                    : track.status === 'PROCESSING' ? 'text-yellow-400'
                    : 'text-red-400'
                  }`}>
                    {track.status === 'READY' ? 'готов'
                      : track.status === 'PROCESSING' ? 'обрабатывается'
                      : 'заблокирован'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <p className="text-sm font-medium mb-4">Добавить трек</p>
            <AddTrackForm releaseId={release.id} nextTrackNumber={tracks.length + 1} />
          </div>
        </section>
      </div>
    </div>
  );
}
