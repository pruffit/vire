import { listTracksAdmin } from '@vire/db';
import { TrackStatusSelect } from './track-status-select';
import { RetranscodeButton } from './retranscode-button';
import { BackfillAnalysisButton } from '../backfill-analysis-button';
import { TracksLiveRefresh } from './live-refresh';
import { formatDuration } from '@/lib/format';
import { getAdminAccess } from '@/lib/admin-access';
import {
  PageHeader, FilterTabs, Table, Thead, Th, Tr, Td, TrackStatusBadge, ActionLink, EmptyState,
} from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const STATUS_FILTERS: { value?: string; label: string }[] = [
  { value: undefined, label: 'Все' },
  { value: 'PROCESSING', label: 'обработка' },
  { value: 'READY', label: 'готов' },
  { value: 'BLOCKED', label: 'заблокирован' },
  { value: 'FAILED', label: 'ошибка' },
];

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminTracksPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const [tracks, access] = await Promise.all([listTracksAdmin({ status }), getAdminAccess()]);
  const processing = tracks.filter((t) => t.status === 'PROCESSING').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Треки" count={tracks.length}>
        <TracksLiveRefresh processing={processing} />
        <BackfillAnalysisButton canRun={access.canRunJobs} />
      </PageHeader>

      <FilterTabs
        tabs={STATUS_FILTERS.map((s) => ({
          href: s.value ? `?status=${s.value}` : '/admin/tracks',
          label: s.label,
          active: status === s.value,
        }))}
      />

      <Table minWidth="md:min-w-[880px]">
        <Thead>
          <Th>Трек</Th>
          <Th>Релиз</Th>
          <Th>Артист</Th>
          <Th>Статус</Th>
          <Th align="right">Аудио</Th>
          <Th align="right">Прослуш.</Th>
          <Th align="right">Лайки</Th>
          <Th>Дата</Th>
          <Th />
        </Thead>
        <tbody>
          {tracks.map((track) => (
            <Tr key={track.id}>
              <Td>
                <span className="mr-2 font-mono text-xs text-foreground/30 tabular-nums">{track.trackNumber}.</span>
                {track.title}
              </Td>
              <Td label="Релиз" tone="soft" className="text-xs">
                <a
                  href={`/artists/${track.artistSlug}/releases/${track.releaseId}`}
                  target="_blank"
                  className="hover:text-foreground transition-colors"
                >
                  {track.releaseTitle}
                </a>
              </Td>
              <Td label="Артист" tone="soft" mono>
                <a
                  href={`/artists/${track.artistSlug}`}
                  target="_blank"
                  className="hover:text-foreground transition-colors"
                >
                  @{track.artistSlug}
                </a>
              </Td>
              <Td label="Статус">
                <div className="flex items-center gap-1.5">
                  <TrackStatusBadge status={track.status} />
                  {track.status === 'READY' && !track.hasHls && (
                    <span className="font-mono text-[10px] text-red-400" title="READY без HLS-манифеста">
                      !hls
                    </span>
                  )}
                </div>
              </Td>
              <Td label="Аудио" align="right" tone="soft" mono nums nowrap>
                {[
                  track.durationSec != null ? formatDuration(track.durationSec) : null,
                  track.bpm != null ? `${track.bpm} bpm` : null,
                  track.musicalKey,
                ].filter(Boolean).join(' · ') || '—'}
              </Td>
              <Td label="Прослуш." align="right" tone="soft" nums className="text-xs">{track.playsTotal}</Td>
              <Td label="Лайки" align="right" tone="soft" nums className="text-xs">{track.likesCount}</Td>
              <Td label="Дата" mono tone="faint">
                {new Date(track.createdAt).toLocaleDateString('ru-RU')}
              </Td>
              <Td>
                <div className="flex flex-wrap items-center gap-2">
                  <TrackStatusSelect
                    trackId={track.id}
                    currentStatus={track.status as 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED'}
                    canMutate={access.canModerate}
                  />
                  <RetranscodeButton trackId={track.id} canMutate={access.canModerate} />
                  <ActionLink href={`/admin/tracks/${track.id}/edit`}>Изм.</ActionLink>
                </div>
              </Td>
            </Tr>
          ))}
          {tracks.length === 0 && (
            <Tr>
              <Td colSpan={9}>
                <EmptyState
                  title={status ? 'Треков в этом статусе нет' : 'Треков пока нет'}
                  hint={status ? 'Сними фильтр, чтобы увидеть все.' : undefined}
                />
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
