import { notFound } from 'next/navigation';
import { db, DrizzleTrackRepository, getTrackAudioMeta, getTrackMoods, getTrackGenres, getGenreSuggestionsForTracks } from '@vire/db';
import { isGenre, type Genre } from '@/lib/genres';
import { serializeLrc } from '@/lib/lrc';
import { TrackEditForm } from './track-edit-form';
import { DetailHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminTrackEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = new DrizzleTrackRepository(db);
  const [track, meta, moods, genres, genreSuggestionsMap] = await Promise.all([
    repo.findById(id),
    getTrackAudioMeta([id]),
    getTrackMoods(id),
    getTrackGenres(id),
    getGenreSuggestionsForTracks([id]),
  ]);
  if (!track) notFound();
  const m = meta[id] ?? { bpm: null, musicalKey: null };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <DetailHeader backHref="/admin/tracks" backLabel="Треки" title="Редактировать трек" subtitle={track.id} />
      <TrackEditForm
        trackId={track.id}
        initial={{
          title: track.title,
          version: track.version ?? '',
          trackNumber: track.trackNumber,
          isExplicit: track.isExplicit,
          isExclusive: track.isExclusive,
          isWip: track.isWip,
          bpm: m.bpm,
          musicalKey: m.musicalKey ?? '',
          moods: moods as string[],
          genres: genres as string[],
          credits: track.credits,
          lyrics: serializeLrc(track.lyrics),
        }}
        genreSuggestions={(genreSuggestionsMap[id] ?? []).filter(
          (s): s is { genre: Genre; confidence: number } => isGenre(s.genre),
        )}
      />
    </div>
  );
}
