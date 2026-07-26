import { listReleasesAdmin } from '@vire/db';
import { ReleaseStatusSelect } from './release-status-select';
import {
  PageHeader, FilterTabs, Table, Thead, Th, Tr, Td, ReleaseStatusBadge, ActionLink, EmptyState,
} from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const STATUS_FILTERS: { value?: string; label: string }[] = [
  { value: undefined, label: 'Все' },
  { value: 'DRAFT', label: 'черновик' },
  { value: 'SCHEDULED', label: 'запланирован' },
  { value: 'PUBLISHED', label: 'опубликован' },
  { value: 'ARCHIVED', label: 'архив' },
];

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminReleasesPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const releases = await listReleasesAdmin({ status });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Релизы" count={releases.length} />

      <FilterTabs
        tabs={STATUS_FILTERS.map((s) => ({
          href: s.value ? `?status=${s.value}` : '/admin/releases',
          label: s.label,
          active: status === s.value,
        }))}
      />

      <Table minWidth="md:min-w-[620px]">
        <Thead>
          <Th>Релиз</Th>
          <Th>Артист</Th>
          <Th>Тип</Th>
          <Th align="right">Треков</Th>
          <Th>Дата</Th>
          <Th />
        </Thead>
        <tbody>
          {releases.map((release) => (
            <Tr key={release.id}>
              <Td>
                <div className="flex items-center gap-2">
                  <a
                    href={`/artists/${release.artistSlug}/releases/${release.id}`}
                    target="_blank"
                    className="hover:text-foreground/60 transition-colors"
                  >
                    {release.title}
                  </a>
                  <ReleaseStatusBadge status={release.status} />
                </div>
              </Td>
              <Td label="Артист" tone="soft" mono>
                <a
                  href={`/artists/${release.artistSlug}`}
                  target="_blank"
                  className="hover:text-foreground transition-colors"
                >
                  @{release.artistSlug}
                </a>
              </Td>
              <Td label="Тип" tone="muted" mono>{release.type}</Td>
              <Td label="Треков" align="right" tone="muted" nums className="text-xs">{release.trackCount}</Td>
              <Td label="Дата" mono tone="faint">
                {new Date(release.createdAt).toLocaleDateString('ru-RU')}
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-2">
                  {release.status !== 'SCHEDULED' && (
                    <ReleaseStatusSelect
                      releaseId={release.id}
                      currentStatus={release.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'}
                    />
                  )}
                  <ActionLink href={`/admin/releases/${release.id}/edit`}>Изм.</ActionLink>
                </div>
              </Td>
            </Tr>
          ))}
          {releases.length === 0 && (
            <Tr>
              <Td colSpan={6}>
                <EmptyState
                  title={status ? 'Релизов в этом статусе нет' : 'Релизов пока нет'}
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
