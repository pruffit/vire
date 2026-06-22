import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository, getMoodsForTracks, getTrackAudioMeta, getGenresForTracks } from '@vire/db';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { EditReleaseForm } from './edit-release-form';
import { BatchTrackUpload } from './batch-track-upload';
import { TrackManager } from './track-manager';
import { DeleteReleaseButton } from './delete-release-button';
import { btnGhost } from '@/components/ui-kit';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditReleasePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard');

  const { id } = await params;

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) redirect('/dashboard');

  const releaseRepo = new DrizzleReleaseRepository(db);
  const data = await releaseRepo.findWithTracks(id);
  if (!data) notFound();
  if (data.release.artistProfileId !== artist.id) notFound();

  const { release, tracks } = data;
  const trackIds = tracks.map((t) => t.id);
  const [moodsMap, audioMetaMap, genresMap] = await Promise.all([
    getMoodsForTracks(trackIds),
    getTrackAudioMeta(trackIds),
    getGenresForTracks(trackIds),
  ]);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className={btnGhost}>← Назад</a>
          <h1 className="text-2xl font-semibold">Редактировать релиз</h1>
        </div>

        <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-6">
          <EditReleaseForm
            releaseId={release.id}
            artistName={artist.name}
            initial={{
              title: release.title,
              type: release.type,
              genre: release.genre ?? null,
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
            <span className="ml-2 text-sm text-foreground/30 font-normal tabular-nums">{tracks.length}</span>
          </h2>

          <TrackManager
            key={tracks.map((t) => t.id).join('-')}
            releaseId={release.id}
            artistName={artist.name}
            initial={tracks.map((t) => ({
              id: t.id,
              title: t.title,
              version: t.version,
              trackNumber: t.trackNumber,
              status: t.status,
              moods: moodsMap[t.id] ?? [],
              genres: genresMap[t.id] ?? [],
              credits: t.credits,
              bpm: audioMetaMap[t.id]?.bpm ?? null,
              musicalKey: audioMetaMap[t.id]?.musicalKey ?? null,
              isExplicit: t.isExplicit,
              isExclusive: t.isExclusive,
              isWip: t.isWip,
              lyrics: t.lyrics,
            }))}
          />

          <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-5">
            <p className="text-sm font-medium mb-4">Добавить треки</p>
            <BatchTrackUpload
              releaseId={release.id}
              nextTrackNumber={tracks.length + 1}
              artistName={artist.name}
            />
          </div>
        </section>

        <div className="border-t border-foreground/[0.06] pt-4">
          <DeleteReleaseButton releaseId={release.id} title={release.title} />
        </div>
      </div>
    </div>
  );
}
