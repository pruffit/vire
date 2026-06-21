import { notFound } from 'next/navigation';
import { db, DrizzleTrackRepository, getTrackAudioMeta, getTrackMoods, getTrackGenres } from '@vire/db';
import { serializeLrc } from '@/lib/lrc';
import { TrackEditForm } from './track-edit-form';

export const dynamic = 'force-dynamic';

export default async function AdminTrackEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = new DrizzleTrackRepository(db);
  const [track, meta, moods, genres] = await Promise.all([
    repo.findById(id),
    getTrackAudioMeta([id]),
    getTrackMoods(id),
    getTrackGenres(id),
  ]);
  if (!track) notFound();
  const m = meta[id] ?? { bpm: null, musicalKey: null };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <a href="/admin/tracks" className="text-sm text-white/40 hover:text-white transition-colors">← Треки</a>
        <h1 className="text-2xl font-semibold mt-2">Редактировать трек</h1>
        <p className="text-xs text-white/30 font-mono mt-1">{track.id}</p>
      </div>
      <TrackEditForm
        trackId={track.id}
        initial={{
          title: track.title,
          trackNumber: track.trackNumber,
          isExplicit: track.isExplicit,
          isExclusive: track.isExclusive,
          isWip: track.isWip,
          bpm: m.bpm,
          musicalKey: m.musicalKey ?? '',
          moods: moods as string[],
          genres: genres as string[],
          lyrics: serializeLrc(track.lyrics),
        }}
      />
    </div>
  );
}
