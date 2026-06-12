import Link from 'next/link';
import {
  getAdminStats, getAdminAttention, getRecentPublishedReleases, getAdminPlatformMetrics,
} from '@vire/db';
import type { AdminAttention, AdminRecentRelease, AdminStats, AdminPlatformMetrics } from '@vire/db';
import { getAdminHealth, type AdminHealth } from '@/lib/admin-health';
import { QueueFailedActions } from './queue-actions';
import { EditorialGenerateButton } from './editorial-generate-button';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [stats, attention, recent, metrics, health] = await Promise.all([
    getAdminStats(),
    getAdminAttention(),
    getRecentPublishedReleases(8),
    getAdminPlatformMetrics(),
    getAdminHealth(),
  ]);

  const hasIssues =
    attention.stuckTracks.length > 0 ||
    attention.blockedTracksCount > 0 ||
    attention.unverifiedArtists.length > 0;

  return (
    <div className="flex flex-col gap-10 max-w-4xl">
      <h1 className="text-xl font-semibold">Обзор</h1>

      {/* Attention panel */}
      {hasIssues && <AttentionPanel attention={attention} />}

      {/* Система */}
      <HealthPanel health={health} />

      {/* Аудитория и каталог */}
      <CatalogPanel stats={stats} metrics={metrics} />

      {/* Вовлечённость */}
      <EngagementPanel metrics={metrics} />

      {/* Recent published */}
      {recent.length > 0 && <RecentReleases releases={recent} />}

      {/* Редакционные подборки */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-white/35 font-mono">Подборки</p>
          <EditorialGenerateButton />
        </div>
        <p className="text-xs text-white/40">
          Алгоритмические плейлисты на главной: по mood-тегам, трендам, переслушиваниям и свежести.
          Нажми «Обновить», чтобы пересчитать сейчас.
        </p>
      </section>
    </div>
  );
}

// ─── Система ───────────────────────────────────────────────────────────────

function HealthPanel({ health }: { health: AdminHealth }) {
  const failedTotal = health.queues.reduce((s, q) => s + q.failed, 0);
  return (
    <section>
      <p className="text-xs text-white/35 font-mono mb-3">Система</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <HealthCard
          label="PostgreSQL"
          ok={health.dbLatencyMs !== null}
          value={health.dbLatencyMs !== null ? `${health.dbLatencyMs} мс` : 'недоступен'}
        />
        <HealthCard
          label="Redis"
          ok={health.redisLatencyMs !== null}
          value={health.redisLatencyMs !== null ? `${health.redisLatencyMs} мс` : 'недоступен'}
        />
        <HealthCard
          label="Слушают сейчас"
          ok
          value={String(health.liveListeners)}
        />
        <HealthCard
          label="Ошибок в очередях"
          ok={failedTotal === 0}
          value={String(failedTotal)}
        />
      </div>
      <div className="mt-3 rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-xs text-white/30 border-b border-white/10">
              <th className="px-4 py-2 text-left font-normal">Очередь</th>
              <th className="px-4 py-2 text-right font-normal">в ожидании</th>
              <th className="px-4 py-2 text-right font-normal">в работе</th>
              <th className="px-4 py-2 text-right font-normal">отложено</th>
              <th className="px-4 py-2 text-right font-normal">ошибки</th>
            </tr>
          </thead>
          <tbody>
            {health.queues.map((q) => (
              <tr key={q.name} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2.5">
                  {q.label} <span className="text-xs text-white/25 font-mono ml-1">{q.name}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/60">{q.waiting}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/60">{q.active}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/60">{q.delayed}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${q.failed > 0 ? 'text-red-400' : 'text-white/60'}`}>
                  {q.failed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Детали упавших задач + управление */}
      {health.queues.filter((q) => q.failedJobs.length > 0).map((q) => (
        <div key={q.name} className="mt-3 rounded-lg border border-red-500/25 bg-red-500/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-500/15">
            <span className="text-sm text-red-300">
              {q.label}: упавшие задачи
              <span className="text-xs text-red-400/50 ml-2">
                хранятся в Redis, при повторе нужен запущенный worker
              </span>
            </span>
            <QueueFailedActions queueName={q.name} />
          </div>
          <div className="divide-y divide-red-500/10">
            {q.failedJobs.map((j) => (
              <div key={j.id} className="px-4 py-2 flex items-baseline gap-3">
                <span className="text-xs font-mono text-white/30 shrink-0">#{j.id}</span>
                <span className="text-xs text-white/60 flex-1 min-w-0 truncate" title={j.failedReason}>
                  {j.failedReason}
                </span>
                <span className="text-[10px] font-mono text-white/25 shrink-0 tabular-nums">
                  {j.attemptsMade} поп.
                  {j.finishedOn ? ` · ${new Date(j.finishedOn).toLocaleDateString('ru-RU')}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function HealthCard({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
      <span className="text-xs text-white/35 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} aria-hidden="true" />
        {label}
      </span>
      <span className={`text-xl font-semibold tabular-nums ${ok ? '' : 'text-red-400'}`}>{value}</span>
    </div>
  );
}

// ─── Аудитория и каталог ───────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  LISTENER: 'слушатели',
  ARTIST: 'артисты',
  MODERATOR: 'модераторы',
  ADMIN: 'админы',
  SUPERADMIN: 'суперадмины',
};

const RELEASE_STATUS_SHORT: Record<string, string> = {
  DRAFT: 'черновики',
  SCHEDULED: 'запланированы',
  PUBLISHED: 'опубликованы',
  ARCHIVED: 'архив',
};

function CatalogPanel({ stats, metrics }: { stats: AdminStats; metrics: AdminPlatformMetrics }) {
  const roles = Object.entries(metrics.usersByRole)
    .sort((a, b) => b[1] - a[1])
    .map(([role, n]) => `${n} ${ROLE_LABEL[role] ?? role.toLowerCase()}`)
    .join(' · ');
  const releaseBreakdown = Object.entries(metrics.releasesByStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${n} ${RELEASE_STATUS_SHORT[s] ?? s.toLowerCase()}`)
    .join(' · ');

  return (
    <section>
      <p className="text-xs text-white/35 font-mono mb-3">Аудитория и каталог</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Пользователей"
          value={stats.totalUsers}
          sub={`+${metrics.newUsers7d} за 7 дней`}
          href="/admin/users"
        />
        <StatCard
          label="Артистов"
          value={stats.totalArtists}
          sub={`${metrics.artistsActive} активны · ${metrics.artistsVerified} верифиц.`}
          href="/admin/artists"
        />
        <StatCard
          label="Релизов"
          value={stats.totalReleases}
          sub={releaseBreakdown || undefined}
          href="/admin/releases"
        />
        <StatCard
          label="Треков"
          value={stats.totalTracks}
          sub={`${stats.tracksReady} готовы · ${stats.tracksProcessing} в обработке · ${stats.tracksBlocked} блок.`}
          href="/admin/tracks"
        />
      </div>
      <p className="mt-2 text-xs text-white/25">{roles}</p>
    </section>
  );
}

// ─── Вовлечённость ─────────────────────────────────────────────────────────

function EngagementPanel({ metrics }: { metrics: AdminPlatformMetrics }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs text-white/35 font-mono">Вовлечённость</p>
        <Link href="/admin/analytics" className="text-xs text-white/40 hover:text-white transition-colors">
          Аналитика →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Прослушиваний · 24ч" value={metrics.plays24h} />
        <StatCard label="Прослушиваний · 7д" value={metrics.plays7d} sub={`${metrics.uniqueListeners7d} уник. слушателей`} />
        <StatCard label="Прослушиваний · 30д" value={metrics.plays30d} />
        <StatCard label="Прослушиваний · всего" value={metrics.playsTotal} />
        <StatCard label="Лайков" value={metrics.likesTotal} sub={`+${metrics.likes7d} за 7 дней`} />
        <StatCard label="Подписок на артистов" value={metrics.followsTotal} sub={`+${metrics.follows7d} за 7 дней`} />
        <StatCard label="Плейлистов" value={metrics.playlistsTotal} />
        <StatCard label="Постов артистов" value={metrics.postsTotal} />
        <StatCard label="Mood-тегов" value={metrics.moodTagsTotal} />
        <StatCard label="Любимых моментов" value={metrics.momentsTotal} />
      </div>
    </section>
  );
}

function StatCard({
  label, value, sub, href,
}: {
  label: string; value: number; sub?: string; href?: string;
}) {
  const inner = (
    <>
      <span className="text-xs text-white/35">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value.toLocaleString('ru-RU')}</span>
      {sub && <span className="text-xs text-white/25">{sub}</span>}
    </>
  );
  const cls = 'rounded-xl bg-white/5 border border-white/10 p-5 flex flex-col gap-1';
  return href ? (
    <Link href={href} className={`${cls} hover:bg-white/[0.08] transition-colors`}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
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
              href="/admin/artists"
              className="text-xs text-blue-400/60 hover:text-blue-300 transition-colors"
            >
              К артистам →
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

// ─── Recent releases ───────────────────────────────────────────────────────

function RecentReleases({ releases }: { releases: AdminRecentRelease[] }) {
  return (
    <section>
      <p className="text-xs text-white/35 font-mono mb-3">Недавно опубликовано</p>
      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
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
