import { listUsersAdmin } from '@vire/db';
import type { UserRole } from '@vire/db';
import { UserRoleSelect } from './user-role-select';
import { VerifyButton } from './verify-button';
import { CreateArtistForm } from './create-artist-form';

export const dynamic = 'force-dynamic';

const ROLE_COLOR: Record<string, string> = {
  SUPERADMIN: 'text-red-400',
  ADMIN: 'text-orange-400',
  MODERATOR: 'text-yellow-400',
  ARTIST: 'text-blue-400',
  LISTENER: 'text-white/35',
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const users = await listUsersAdmin({ search: q });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Пользователи</h1>
        <span className="text-sm text-white/30 tabular-nums">{users.length}</span>
      </div>

      <CreateArtistForm />

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск по email или имени…"
          className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 flex-1 sm:flex-none sm:w-72"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-white/8 hover:bg-white/12 text-sm transition-colors"
        >
          Найти
        </button>
      </form>

      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/30 text-xs font-mono">
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
              <tr
                key={user.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-mono text-xs text-white/60">{user.email}</td>
                <td className="px-4 py-3 text-white/70">{user.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs ${ROLE_COLOR[user.role] ?? 'text-white/35'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.artistSlug ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`/artists/${user.artistSlug}`}
                        target="_blank"
                        className="text-xs text-white/55 hover:text-white underline underline-offset-2 transition-colors"
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
                    <span className="text-white/20">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/25 text-xs font-mono">
                  {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3">
                  <UserRoleSelect
                    userId={user.id}
                    currentRole={user.role as UserRole}
                    artistProfileId={user.artistProfileId ?? undefined}
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
