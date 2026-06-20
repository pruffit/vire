import { listTracksAdmin } from '@vire/db';
import { TrackStatusSelect } from './track-status-select';
import { BackfillAnalysisButton } from '../backfill-analysis-button';
import { formatDuration } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  READY: 'text-green-400',
  PROCESSING: 'text-yellow-400',
  BLOCKED: 'text-red-400',
  FAILED: 'text-red-500',
};

const STATUS_LABEL: Record<string, string> = {
  READY: 'готов',
  PROCESSING: 'обрабатывается',
  BLOCKED: 'заблокирован',
  FAILED: 'ошибка',
};

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminTracksPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const tracks = await listTracksAdmin({ status });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Треки</h1>
        <div className="flex items-center gap-3">
          <BackfillAnalysisButton />
          <span className="text-sm text-white/40">{tracks.length}</span>
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        {[undefined, 'PROCESSING', 'READY', 'BLOCKED', 'FAILED'].map((s) => (
          <a
            key={s ?? 'all'}
            href={s ? `?status=${s}` : '/admin/tracks'}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              status === s
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {s ? STATUS_LABEL[s] : 'Все'}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/40 text-xs font-mono uppercase tracking-wider">
              <th className="text-left px-4 py-3">Трек</th>
              <th className="text-left px-4 py-3">Релиз</th>
              <th className="text-left px-4 py-3">Артист</th>
              <th className="text-left px-4 py-3">Статус</th>
              <th className="text-right px-4 py-3">Аудио</th>
              <th className="text-right px-4 py-3">Прослуш.</th>
              <th className="text-right px-4 py-3">Лайки</th>
              <th className="text-left px-4 py-3">Дата</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr key={track.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <span className="text-white/30 font-mono text-xs mr-2">{track.trackNumber}.</span>
                  {track.title}
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  <a
                    href={`/artists/${track.artistSlug}/releases/${track.releaseId}`}
                    target="_blank"
                    className="hover:text-white transition-colors"
                  >
                    {track.releaseTitle}
                  </a>
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  <a
                    href={`/artists/${track.artistSlug}`}
                    target="_blank"
                    className="hover:text-white transition-colors"
                  >
                    @{track.artistSlug}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs ${STATUS_COLOR[track.status] ?? ''}`}>
                    {STATUS_LABEL[track.status] ?? track.status}
                  </span>
                  {track.status === 'READY' && !track.hasHls && (
                    <span className="ml-1.5 text-[10px] font-mono text-red-400" title="READY без HLS-манифеста">
                      !hls
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-white/50 text-xs font-mono tabular-nums whitespace-nowrap">
                  {[
                    track.durationSec != null ? formatDuration(track.durationSec) : null,
                    track.bpm != null ? `${track.bpm} bpm` : null,
                    track.musicalKey,
                  ].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-4 py-3 text-right text-white/60 text-xs tabular-nums">{track.playsTotal}</td>
                <td className="px-4 py-3 text-right text-white/60 text-xs tabular-nums">{track.likesCount}</td>
                <td className="px-4 py-3 text-white/30 text-xs font-mono">
                  {new Date(track.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3">
                  <TrackStatusSelect trackId={track.id} currentStatus={track.status as 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tracks.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-white/30">Треков нет</p>
        )}
      </div>
    </div>
  );
}
