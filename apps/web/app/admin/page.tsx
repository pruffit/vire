import Link from 'next/link';
import { getAdminStats, getAdminAttention, getRecentPublishedReleases } from '@vire/db';
import type { AdminAttention, AdminRecentRelease, AdminStats } from '@vire/db';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [stats, attention, recent] = await Promise.all([
    getAdminStats(),
    getAdminAttention(),
    getRecentPublishedReleases(8),
  ]);

  const hasIssues =
    attention.stuckTracks.length > 0 ||
    attention.blockedTracksCount > 0 ||
    attention.unverifiedArtists.length > 0;

  return (
    <div className="flex flex-col gap-10 max-w-3xl">
      <h1 className="text-xl font-semibold">Обзор</h1>

      {/* Attention panel */}
      {hasIssues && <AttentionPanel attention={attention} />}

      {/* Key metrics */}
      <MetricsRow stats={stats} />

      {/* Recent published */}
      {recent.length > 0 && <RecentReleases releases={recent} />}
    </div>
  );
}

// ─── Attention ─────────────────────────────────────────────────────────────

function AttentionPanel({ attention }: { attention: AdminAttention }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs text-white/35 font-mono mb-1">Требует внимания</p>

      {attention.stuckTracks.length > 0 && (
        <AlertRow
          variant="error"
          href="/admin/tracks?status=PROCESSING"
          label={`${attention.stuckTracks.length} ${plural(attention.stuckTracks.length, 'трек', 'трека', 'треков')} зависл${attention.stuckTracks.length === 1 ? '' : 'о'} в обработке`}
          sub="не двигается более 2 часов — возможная ошибка ffmpeg"
        />
      )}

      {attention.blockedTracksCount > 0 && (
        <AlertRow
          variant="warn"
          href="/admin/tracks?status=BLOCKED"
          label={`${attention.blockedTracksCount} ${plural(attention.blockedTracksCount, 'трек', 'трека', 'треков')} заблокировано`}
          sub="ожидают ручной проверки или разблокировки"
        />
      )}

      {attention.unverifiedArtists.length > 0 && (
        <div className="rounded-lg border border-blue-500/25 bg-blue-500/8 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-sm font-medium text-blue-300">
                {attention.unverifiedArtists.length}{' '}
                {plural(attention.unverifiedArtists.length, 'артист', 'артиста', 'артистов')} без верификации
              </span>
              <span className="text-xs text-blue-400/50 ml-2">с опубликованными релизами</span>
            </div>
            <Link
              href="/admin/users"
              className="text-xs text-blue-400/60 hover:text-blue-300 transition-colors"
            >
              К пользователям →
            </Link>
          </div>
          <div className="border-t border-blue-500/15 divide-y divide-blue-500/10">
            {attention.unverifiedArtists.map((a) => (
              <div key={a.profileId} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-white/70">{a.name}</span>
                  <span className="text-xs text-white/25 font-mono">@{a.slug}</span>
                </div>
                <span className="text-xs text-white/30 tabular-nums">
                  {a.publishedCount} {plural(a.publishedCount, 'релиз', 'релиза', 'релизов')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AlertRow({
  variant,
  href,
  label,
  sub,
}: {
  variant: 'error' | 'warn';
  href: string;
  label: string;
  sub?: string;
}) {
  const cls =
    variant === 'error'
      ? 'border-red-500/25 bg-red-500/8 text-red-300'
      : 'border-amber-500/25 bg-amber-500/8 text-amber-300';

  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3 rounded-lg border ${cls} hover:opacity-80 transition-opacity`}
    >
      <div className="min-w-0">
        <span className="text-sm font-medium">{label}</span>
        {sub && <span className="text-xs opacity-50 ml-2 hidden sm:inline">{sub}</span>}
      </div>
      <span className="text-xs opacity-40 shrink-0 ml-4">→</span>
    </Link>
  );
}

// ─── Metrics ───────────────────────────────────────────────────────────────

function MetricsRow({ stats }: { stats: AdminStats }) {
  return (
    <section>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Пользователей" value={stats.totalUsers} />
        <StatCard label="Артистов" value={stats.totalArtists} />
        <StatCard
          label="Треков"
          value={stats.totalTracks}
          sub={`${stats.tracksReady} готовы`}
        />
        <StatCard label="Релизов" value={stats.totalReleases} />
      </div>
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5 flex flex-col gap-1">
      <span className="text-xs text-white/35">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value.toLocaleString('ru-RU')}</span>
      {sub && <span className="text-xs text-white/25">{sub}</span>}
    </div>
  );
}

// ─── Recent releases ───────────────────────────────────────────────────────

function RecentReleases({ releases }: { releases: AdminRecentRelease[] }) {
  return (
    <section>
      <p className="text-xs text-white/35 font-mono mb-3">Недавно опубликовано</p>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {releases.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <a
                    href={`/artists/${r.artistSlug}/releases/${r.id}`}
                    target="_blank"
                    className="hover:text-white/70 transition-colors"
                  >
                    {r.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs">
                  <a
                    href={`/artists/${r.artistSlug}`}
                    target="_blank"
                    className="hover:text-white/70 transition-colors"
                  >
                    {r.artistName}
                  </a>
                </td>
                <td className="px-4 py-3 text-white/25 text-xs font-mono">
                  {r.type}
                </td>
                <td className="px-4 py-3 text-white/25 text-xs font-mono text-right">
                  {new Date(r.updatedAt).toLocaleDateString('ru-RU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
