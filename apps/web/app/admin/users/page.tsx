import { listUsersAdmin } from '@vire/db';
import type { UserRole } from '@vire/db';
import { UserRoleSelect } from './user-role-select';

export const dynamic = 'force-dynamic';

const ROLE_COLOR: Record<string, string> = {
  SUPERADMIN: 'text-red-400',
  ADMIN: 'text-orange-400',
  MODERATOR: 'text-yellow-400',
  ARTIST: 'text-blue-400',
  LISTENER: 'text-white/40',
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const users = await listUsersAdmin({ search: q });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Пользователи</h1>
        <span className="text-sm text-white/40">{users.length}</span>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск по email или имени…"
          className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 w-72"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm transition-colors"
        >
          Найти
        </button>
      </form>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/40 text-xs font-mono uppercase tracking-wider">
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Имя</th>
              <th className="text-left px-4 py-3">Роль</th>
              <th className="text-left px-4 py-3">Артист</th>
              <th className="text-left px-4 py-3">Дата</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-xs">{user.email}</td>
                <td className="px-4 py-3 text-white/70">{user.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs ${ROLE_COLOR[user.role] ?? 'text-white/40'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.artistSlug ? (
                    <span className="text-xs">
                      <a
                        href={`/artists/${user.artistSlug}`}
                        target="_blank"
                        className="text-white/60 hover:text-white underline underline-offset-2"
                      >
                        @{user.artistSlug}
                      </a>
                      {user.artistVerified && (
                        <span className="ml-1.5 text-blue-400">✓</span>
                      )}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-white/30 text-xs font-mono">
                  {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3">
                  <UserRoleSelect
                    userId={user.id}
                    currentRole={user.role as UserRole}
                    artistProfileId={user.artistSlug ? undefined : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-white/30">Пользователи не найдены</p>
        )}
      </div>
    </div>
  );
}
