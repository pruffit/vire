import { listTracksAdmin } from '@vire/db';
import { TrackStatusSelect } from './track-status-select';
import { RetranscodeButton } from './retranscode-button';
import { BackfillAnalysisButton } from '../backfill-analysis-button';
import { formatDuration } from '@/lib/format';
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
  const tracks = await listTracksAdmin({ status });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Треки" count={tracks.length}>
        <BackfillAnalysisButton />
      </PageHeader>

      <FilterTabs
        tabs={STATUS_FILTERS.map((s) => ({
          href: s.value ? `?status=${s.value}` : '/admin/tracks',
          label: s.label,
          active: status === s.value,
        }))}
      />

      <Table minWidth="min-w-[880px]">
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
              <Td tone="soft" className="text-xs">
                <a
                  href={`/artists/${track.artistSlug}/releases/${track.releaseId}`}
                  target="_blank"
                  className="hover:text-foreground transition-colors"
                >
                  {track.releaseTitle}
                </a>
              </Td>
              <Td tone="soft" mono>
                <a
                  href={`/artists/${track.artistSlug}`}
                  target="_blank"
                  className="hover:text-foreground transition-colors"
                >
                  @{track.artistSlug}
                </a>
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <TrackStatusBadge status={track.status} />
                  {track.status === 'READY' && !track.hasHls && (
                    <span className="font-mono text-[10px] text-red-400" title="READY без HLS-манифеста">
                      !hls
                    </span>
                  )}
                </div>
              </Td>
              <Td align="right" tone="soft" mono nums nowrap>
                {[
                  track.durationSec != null ? formatDuration(track.durationSec) : null,
                  track.bpm != null ? `${track.bpm} bpm` : null,
                  track.musicalKey,
                ].filter(Boolean).join(' · ') || '—'}
              </Td>
              <Td align="right" tone="soft" nums className="text-xs">{track.playsTotal}</Td>
              <Td align="right" tone="soft" nums className="text-xs">{track.likesCount}</Td>
              <Td mono tone="faint">
                {new Date(track.createdAt).toLocaleDateString('ru-RU')}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <TrackStatusSelect trackId={track.id} currentStatus={track.status as 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED'} />
                  <RetranscodeButton trackId={track.id} />
                  <ActionLink href={`/admin/tracks/${track.id}/edit`}>Изм.</ActionLink>
                </div>
              </Td>
            </Tr>
          ))}
          {tracks.length === 0 && (
            <tr>
              <td colSpan={9}>
                <EmptyState
                  title={status ? 'Треков в этом статусе нет' : 'Треков пока нет'}
                  hint={status ? 'Сними фильтр, чтобы увидеть все.' : undefined}
                />
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
