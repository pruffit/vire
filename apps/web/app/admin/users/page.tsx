import { listUsersAdmin } from '@vire/db';
import type { UserRole } from '@vire/db';
import { UserRoleSelect } from './user-role-select';
import { VerifyButton } from './verify-button';
import { CreateArtistForm } from './create-artist-form';
import {
  PageHeader, SearchForm, Table, Thead, Th, Tr, Td, RoleBadge, EmptyState,
} from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const users = await listUsersAdmin({ search: q });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Пользователи" count={users.length} />

      <CreateArtistForm />

      <SearchForm defaultValue={q} placeholder="Поиск по email или имени…" />

      <Table minWidth="min-w-[680px]">
        <Thead>
          <Th>Email</Th>
          <Th>Имя</Th>
          <Th>Роль</Th>
          <Th>Артист</Th>
          <Th>Дата</Th>
          <Th />
        </Thead>
        <tbody>
          {users.map((user) => (
            <Tr key={user.id}>
              <Td mono tone="soft">{user.email}</Td>
              <Td tone="soft">{user.name ?? '—'}</Td>
              <Td>
                <RoleBadge role={user.role} />
              </Td>
              <Td>
                {user.artistSlug ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={`/artists/${user.artistSlug}`}
                      target="_blank"
                      className="text-xs text-foreground/55 hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      @{user.artistSlug}
                    </a>
                    {user.artistProfileId && (
                      <VerifyButton
                        artistProfileId={user.artistProfileId}
                        verified={user.artistVerified ?? false}
                      />
                    )}
                  </div>
                ) : (
                  <span className="text-foreground/20">—</span>
                )}
              </Td>
              <Td mono tone="faint">
                {new Date(user.createdAt).toLocaleDateString('ru-RU')}
              </Td>
              <Td>
                <UserRoleSelect
                  userId={user.id}
                  currentRole={user.role as UserRole}
                  artistProfileId={user.artistProfileId ?? undefined}
                />
              </Td>
            </Tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title={q ? 'Никого не нашли' : 'Пользователей пока нет'}
                  hint={q ? 'Попробуй другой email или имя.' : undefined}
                />
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
