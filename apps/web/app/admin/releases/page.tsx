import { listReleasesAdmin } from '@vire/db';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: 'text-green-400',
  SCHEDULED: 'text-blue-400',
  DRAFT: 'text-white/40',
  ARCHIVED: 'text-white/20',
};

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: 'опубликован',
  SCHEDULED: 'запланирован',
  DRAFT: 'черновик',
  ARCHIVED: 'архив',
};

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminReleasesPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const releases = await listReleasesAdmin({ status });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Релизы</h1>
        <span className="text-sm text-white/40">{releases.length}</span>
      </div>

      <div className="flex gap-2 text-sm flex-wrap">
        {[undefined, 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((s) => (
          <a
            key={s ?? 'all'}
            href={s ? `?status=${s}` : '/admin/releases'}
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

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/40 text-xs font-mono uppercase tracking-wider">
              <th className="text-left px-4 py-3">Релиз</th>
              <th className="text-left px-4 py-3">Артист</th>
              <th className="text-left px-4 py-3">Тип</th>
              <th className="text-left px-4 py-3">Статус</th>
              <th className="text-left px-4 py-3">Треков</th>
              <th className="text-left px-4 py-3">Дата</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr key={release.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <a
                    href={`/artists/${release.artistSlug}/releases/${release.id}`}
                    target="_blank"
                    className="hover:text-white/60 transition-colors"
                  >
                    {release.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  <a
                    href={`/artists/${release.artistSlug}`}
                    target="_blank"
                    className="hover:text-white transition-colors"
                  >
                    @{release.artistSlug}
                  </a>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs font-mono">{release.type}</td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs ${STATUS_COLOR[release.status] ?? ''}`}>
                    {STATUS_LABEL[release.status] ?? release.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs tabular-nums">{release.trackCount}</td>
                <td className="px-4 py-3 text-white/30 text-xs font-mono">
                  {new Date(release.createdAt).toLocaleDateString('ru-RU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {releases.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-white/30">Релизов нет</p>
        )}
      </div>
    </div>
  );
}
