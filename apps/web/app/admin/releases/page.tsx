import { listReleasesAdmin } from '@vire/db';
import { ReleaseStatusSelect } from './release-status-select';

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
        <h1 className="text-xl font-semibold">Релизы</h1>
        <span className="text-sm text-white/30 tabular-nums">{releases.length}</span>
      </div>

      <div className="flex gap-1.5 text-sm flex-wrap">
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
            <tr className="border-b border-white/10 text-white/30 text-xs font-mono">
              <th className="text-left px-4 py-3">Релиз</th>
              <th className="text-left px-4 py-3">Артист</th>
              <th className="text-left px-4 py-3">Тип</th>
              <th className="text-left px-4 py-3">Треков</th>
              <th className="text-left px-4 py-3">Дата</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr
                key={release.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/artists/${release.artistSlug}/releases/${release.id}`}
                      target="_blank"
                      className="hover:text-white/60 transition-colors"
                    >
                      {release.title}
                    </a>
                    <span className={`font-mono text-xs ${STATUS_COLOR[release.status] ?? ''}`}>
                      {STATUS_LABEL[release.status] ?? release.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/45 text-xs">
                  <a
                    href={`/artists/${release.artistSlug}`}
                    target="_blank"
                    className="hover:text-white transition-colors"
                  >
                    @{release.artistSlug}
                  </a>
                </td>
                <td className="px-4 py-3 text-white/35 text-xs font-mono">{release.type}</td>
                <td className="px-4 py-3 text-white/35 text-xs tabular-nums">
                  {release.trackCount}
                </td>
                <td className="px-4 py-3 text-white/25 text-xs font-mono">
                  {new Date(release.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3">
                  {release.status !== 'SCHEDULED' && (
                    <ReleaseStatusSelect
                      releaseId={release.id}
                      currentStatus={release.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'}
                    />
                  )}
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
