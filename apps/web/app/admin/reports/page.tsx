import { reportService } from '@/lib/reports';
import { PageHeader, Section, Table, Thead, Th, Tr, Td, EmptyState, Badge } from '@/components/admin/ui';
import { ReportResolveActions } from './report-resolve-actions';

export const dynamic = 'force-dynamic';

const TARGET_LABEL: Record<string, string> = { USER: 'Пользователь', MESSAGE: 'Сообщение' };

export default async function AdminReportsPage() {
  const reports = await reportService().listOpen(100);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Жалобы" />

      <Section label={`Открытые · ${reports.length}`}>
        {reports.length === 0 ? (
          <EmptyState title="Открытых жалоб нет" />
        ) : (
          <Table minWidth="md:min-w-[720px]">
            <Thead>
              <Th>Причина</Th>
              <Th>Цель</Th>
              <Th>От кого</Th>
              <Th align="right">Дата</Th>
              <Th align="right">Действие</Th>
            </Thead>
            <tbody>
              {reports.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="line-clamp-2 max-w-md text-foreground/80">{r.reason}</span>
                  </Td>
                  <Td label="Цель" tone="muted" className="text-xs">
                    <Badge tone="neutral">{TARGET_LABEL[r.targetType] ?? r.targetType}</Badge>{' '}
                    {r.targetType === 'USER' ? (
                      <a href={`/u/${r.targetId}`} target="_blank" className="hover:text-foreground transition-colors">
                        {r.targetLabel ?? r.targetId}
                      </a>
                    ) : (
                      <span className="font-mono text-foreground/40">{r.targetId}</span>
                    )}
                  </Td>
                  <Td label="От кого" tone="muted" className="text-xs">{r.reporterName ?? r.reporterId}</Td>
                  <Td label="Дата" align="right" tone="faint" mono>{new Date(r.createdAt).toLocaleDateString('ru-RU')}</Td>
                  <Td align="right">
                    <ReportResolveActions reportId={r.id} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}
