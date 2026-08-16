import { featureFlagService } from '@/lib/feature-flags';
import { getAdminAccess } from '@/lib/admin-access';
import { PageHeader, Table, Thead, Th, Tr, Td, EmptyState } from '@/components/admin/ui';
import { FlagRow } from './flag-row';

export const dynamic = 'force-dynamic';

export default async function AdminFlagsPage() {
  const [flags, { canManageFlags }] = await Promise.all([
    featureFlagService().listWithState(),
    getAdminAccess(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <PageHeader title="Флаги" count={flags.length} />
        <p className="max-w-2xl text-sm text-foreground/50">
          Набор флагов задаёт реестр в <code className="font-mono text-xs">@vire/core</code>; в базе хранится только
          переключение. Изменение доезжает до всех процессов в течение 30 секунд.
        </p>
      </div>

      <Table minWidth="md:min-w-[720px]">
        <Thead>
          <Th className="w-full">Флаг</Th>
          <Th>Источник</Th>
          <Th>Изменён</Th>
          <Th align="right">Состояние</Th>
        </Thead>
        <tbody>
          {flags.map((flag) => (
            <FlagRow key={flag.key} flag={{ ...flag, updatedAt: flag.updatedAt?.toISOString() ?? null }} canMutate={canManageFlags} />
          ))}
          {flags.length === 0 && (
            <Tr>
              <Td colSpan={4}>
                <EmptyState
                  title="Флагов нет"
                  hint="Флаг появляется здесь после объявления в реестре FEATURE_FLAGS."
                />
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
