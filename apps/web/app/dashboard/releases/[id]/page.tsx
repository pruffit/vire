import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository, getMoodsForTracks, getTrackAudioMeta, getGenresForTracks } from '@vire/db';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { EditReleaseForm } from './edit-release-form';
import { BatchTrackUpload } from './batch-track-upload';
import { TrackManager } from './track-manager';
import { DeleteReleaseButton } from './delete-release-button';
import { PublishButton } from '../../publish-button';
import { DashboardPageHeader, SectionLabel, Panel, ReleaseStatusBadge } from '@/components/ui-kit';
import { Icon } from '@/components/icon';

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
    <div className="flex flex-col gap-8">
      <DashboardPageHeader
        backHref="/dashboard"
        title={release.title}
        action={
          <>
            <ReleaseStatusBadge status={release.status} />
            {release.status === 'DRAFT' ? (
              <PublishButton
                releaseId={release.id}
                releaseDate={release.releaseDate ? release.releaseDate.toISOString() : null}
              />
            ) : release.status === 'PUBLISHED' ? (
              <a
                href={`/artists/${artist.slug}/releases/${release.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
              >
                Открыть <Icon name="external-link" size={14} />
              </a>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          <SectionLabel>Треки · {tracks.length}</SectionLabel>

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

          <Panel className="p-4 sm:p-5">
            <p className="mb-4 text-sm font-medium">Добавить треки</p>
            <BatchTrackUpload
              releaseId={release.id}
              nextTrackNumber={tracks.length + 1}
              artistName={artist.name}
            />
          </Panel>
        </section>

        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <Panel className="p-4 sm:p-5">
            <SectionLabel>Релиз</SectionLabel>
            <div className="mt-4">
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
          </Panel>

          <DeleteReleaseButton releaseId={release.id} title={release.title} />
        </aside>
      </div>
    </div>
  );
}
