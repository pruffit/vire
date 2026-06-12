import { listArtistsAdmin } from '@vire/db';
import { VerifyButton } from '../users/verify-button';
import { ActiveToggle } from './active-toggle';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminArtistsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const artists = await listArtistsAdmin({ search: q });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Артисты</h1>
        <span className="text-sm text-white/30 tabular-nums">{artists.length}</span>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск по имени или слагу…"
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
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/30 text-xs font-mono">
              <th className="text-left px-4 py-3">Артист</th>
              <th className="text-right px-4 py-3">Фолловеры</th>
              <th className="text-right px-4 py-3">Релизы</th>
              <th className="text-right px-4 py-3">Треки</th>
              <th className="text-right px-4 py-3">Прослуш. 30д</th>
              <th className="text-left px-4 py-3">Создан</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {artists.map((a) => (
              <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <a
                      href={`/artists/${a.slug}`}
                      target="_blank"
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      {a.name}
                    </a>
                    <span className="text-xs text-white/25 font-mono">@{a.slug}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-white/60">{a.followerCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-white/60">{a.releaseCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-white/60">{a.trackCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-white/60">{a.plays30d}</td>
                <td className="px-4 py-3 text-white/25 text-xs font-mono">
                  {new Date(a.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <VerifyButton artistProfileId={a.id} verified={a.verified} />
                    <ActiveToggle artistProfileId={a.id} isActive={a.isActive} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {artists.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-white/30">Артисты не найдены</p>
        )}
      </div>
    </div>
  );
}
