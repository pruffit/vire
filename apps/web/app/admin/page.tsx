import Link from 'next/link';
import { Icon } from '@/components/icon';
import {
  getAdminStats, getAdminAttention, getRecentPublishedReleases, getAdminPlatformMetrics,
} from '@vire/db';
import type { AdminAttention, AdminRecentRelease, AdminStats, AdminPlatformMetrics } from '@vire/db';
import { getAdminHealth, type AdminHealth } from '@/lib/admin-health';
import { reportService } from '@/lib/reports';
import { QueueFailedActions } from './queue-actions';
import { EditorialGenerateButton } from './editorial-generate-button';
import {
  PageHeader, Section, MetricGrid, StatCard, Table, Thead, Th, Tr, Td,
} from '@/components/admin/ui';
import { plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [stats, attention, recent, metrics, health, openReports] = await Promise.all([
    getAdminStats(),
    getAdminAttention(),
    getRecentPublishedReleases(8),
    getAdminPlatformMetrics(),
    getAdminHealth(),
    reportService().countOpen().catch(() => 0),
  ]);

  const hasIssues =
    attention.stuckTracks.length > 0 ||
    attention.failedTracks.length > 0 ||
    attention.blockedTracksCount > 0 ||
    attention.unverifiedArtists.length > 0 ||
    openReports > 0;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Обзор" />

      {hasIssues && <AttentionPanel attention={attention} openReports={openReports} />}

      <HealthPanel health={health} />

      <CatalogPanel stats={stats} metrics={metrics} />

      <EngagementPanel metrics={metrics} />

      {recent.length > 0 && <RecentReleases releases={recent} />}

      <Section
        label="Подборки"
        action={<EditorialGenerateButton />}
      >
        <p className="text-xs text-foreground/45 leading-relaxed max-w-prose">
          Алгоритмические плейлисты на главной: по mood-тегам, трендам, переслушиваниям и свежести.
          Нажми «Обновить», чтобы пересчитать сейчас.
        </p>
      </Section>
    </div>
  );
}

// ─── Система ───────────────────────────────────────────────────────────────

function HealthPanel({ health }: { health: AdminHealth }) {
  const failedTotal = health.queues.reduce((s, q) => s + q.failed, 0);
  return (
    <Section label="Система">
      <MetricGrid>
        <StatCard
          label="PostgreSQL"
          dot={health.dbLatencyMs !== null ? 'ok' : 'error'}
          value={health.dbLatencyMs !== null ? `${health.dbLatencyMs} мс` : 'недоступен'}
        />
        <StatCard
          label="Redis"
          dot={health.redisLatencyMs !== null ? 'ok' : 'error'}
          value={health.redisLatencyMs !== null ? `${health.redisLatencyMs} мс` : 'недоступен'}
        />
        <StatCard label="Слушают сейчас" dot="ok" value={health.liveListeners} />
        <StatCard
          label="Ошибок в очередях"
          dot={failedTotal === 0 ? 'ok' : 'error'}
          value={failedTotal}
        />
        <StatCard
          label="Поиск в сети (YouTube)"
          dot={health.integrations.youtubeSearch ? 'ok' : 'warn'}
          value={health.integrations.youtubeSearch ? 'ключ есть' : 'ключа нет'}
        />
        <StatCard
          label="Вкус Last.fm"
          dot={health.integrations.lastfm ? 'ok' : 'warn'}
          value={health.integrations.lastfm ? 'ключ есть' : 'ключа нет'}
        />
      </MetricGrid>

      <Table minWidth="md:min-w-[520px]">
        <Thead>
          <Th>Очередь</Th>
          <Th align="right">в ожидании</Th>
          <Th align="right">в работе</Th>
          <Th align="right">отложено</Th>
          <Th align="right">ошибки</Th>
        </Thead>
        <tbody>
          {health.queues.map((q) => (
            <Tr key={q.name}>
              <Td>
                {q.label}{' '}
                <span className="ml-1 font-mono text-xs text-foreground/30">{q.name}</span>
              </Td>
              <Td label="в ожидании" align="right" tone="soft" nums>{q.waiting}</Td>
              <Td label="в работе" align="right" tone="soft" nums>{q.active}</Td>
              <Td label="отложено" align="right" tone="soft" nums>{q.delayed}</Td>
              <Td label="ошибки" align="right" nums className={q.failed > 0 ? 'text-red-400' : 'text-foreground/65'}>
                {q.failed}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      {/* Детали упавших задач + управление */}
      {health.queues.filter((q) => q.failedJobs.length > 0).map((q) => (
        <div key={q.name} className="rounded-xl border border-red-500/25 bg-red-500/[0.06] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-red-500/15">
            <span className="text-sm text-red-300">
              {q.label}: упавшие задачи
              <span className="ml-2 text-xs text-red-400/60">
                хранятся в Redis, при повторе нужен запущенный worker
              </span>
            </span>
            <QueueFailedActions queueName={q.name} />
          </div>
          <div className="divide-y divide-red-500/10">
            {q.failedJobs.map((j) => (
              <div key={j.id} className="px-4 py-2 flex items-baseline gap-3">
                <span className="shrink-0 font-mono text-xs text-foreground/30">#{j.id}</span>
                <span className="flex-1 min-w-0 truncate text-xs text-foreground/60" title={j.failedReason}>
                  {j.failedReason}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-foreground/25 tabular-nums">
                  {j.attemptsMade} поп.
                  {j.finishedOn ? ` · ${new Date(j.finishedOn).toLocaleDateString('ru-RU')}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

// ─── Аудитория и каталог ───────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  LISTENER: 'слушатели',
  ARTIST: 'артисты',
  VIEWER: 'наблюдатели',
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
    <Section label="Аудитория и каталог">
      <MetricGrid>
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
      </MetricGrid>
      {roles && <p className="text-xs text-foreground/30">{roles}</p>}
    </Section>
  );
}

// ─── Вовлечённость ─────────────────────────────────────────────────────────

function EngagementPanel({ metrics }: { metrics: AdminPlatformMetrics }) {
  return (
    <Section
      label="Вовлечённость"
      action={
        <Link href="/admin/analytics" className="inline-flex items-center gap-1 text-xs text-foreground/45 hover:text-foreground transition-colors">
          Аналитика <Icon name="arrow-right" size={13} />
        </Link>
      }
    >
      <MetricGrid>
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
      </MetricGrid>
    </Section>
  );
}

// ─── Attention ─────────────────────────────────────────────────────────────

function AttentionPanel({ attention, openReports }: { attention: AdminAttention; openReports: number }) {
  return (
    <Section label="Требует внимания">
      {openReports > 0 && (
        <AlertRow
          variant="warn"
          href="/admin/reports"
          label={`${openReports} ${plural(openReports, ['жалоба', 'жалобы', 'жалоб'])} на рассмотрении`}
          sub="открытые обращения пользователей"
        />
      )}

      {attention.stuckTracks.length > 0 && (
        <AlertRow
          variant="error"
          href="/admin/tracks?status=PROCESSING"
          label={`${attention.stuckTracks.length} ${plural(attention.stuckTracks.length, ['трек', 'трека', 'треков'])} зависл${attention.stuckTracks.length === 1 ? '' : 'о'} в обработке`}
          sub="не двигается более 2 часов — возможная ошибка ffmpeg"
        />
      )}

      {attention.failedTracks.length > 0 && (
        <AlertRow
          variant="error"
          href="/admin/tracks?status=FAILED"
          label={`${attention.failedTracks.length} ${plural(attention.failedTracks.length, ['трек', 'трека', 'треков'])} с ошибкой транскодинга`}
          sub="транскодинг упал после всех попыток — артист уведомлён письмом"
        />
      )}

      {attention.blockedTracksCount > 0 && (
        <AlertRow
          variant="warn"
          href="/admin/tracks?status=BLOCKED"
          label={`${attention.blockedTracksCount} ${plural(attention.blockedTracksCount, ['трек', 'трека', 'треков'])} заблокировано`}
          sub="ожидают ручной проверки или разблокировки"
        />
      )}

      {attention.unverifiedArtists.length > 0 && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <span className="text-sm font-medium text-sky-300">
                {attention.unverifiedArtists.length}{' '}
                {plural(attention.unverifiedArtists.length, ['артист', 'артиста', 'артистов'])} без верификации
              </span>
              <span className="ml-2 text-xs text-sky-400/60">с опубликованными релизами</span>
            </div>
            <Link
              href="/admin/artists"
              className="shrink-0 inline-flex items-center gap-1 text-xs text-sky-400/70 hover:text-sky-300 transition-colors"
            >
              К артистам <Icon name="arrow-right" size={13} />
            </Link>
          </div>
          <div className="border-t border-sky-500/15 divide-y divide-sky-500/10">
            {attention.unverifiedArtists.map((a) => (
              <div key={a.profileId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="truncate text-sm text-foreground/75">{a.name}</span>
                  <span className="shrink-0 font-mono text-xs text-foreground/30">@{a.slug}</span>
                </div>
                <span className="shrink-0 text-xs text-foreground/35 tabular-nums">
                  {a.publishedCount} {plural(a.publishedCount, ['релиз', 'релиза', 'релизов'])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
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
      ? 'border-red-500/25 bg-red-500/[0.07] text-red-300 hover:bg-red-500/[0.11]'
      : 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300 hover:bg-amber-500/[0.11]';

  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border transition-colors ${cls}`}
    >
      <div className="min-w-0">
        <span className="text-sm font-medium">{label}</span>
        {sub && <span className="ml-2 text-xs opacity-60 hidden sm:inline">{sub}</span>}
      </div>
      <Icon name="arrow-right" size={14} className="shrink-0 opacity-50" />
    </Link>
  );
}

// ─── Recent releases ───────────────────────────────────────────────────────

function RecentReleases({ releases }: { releases: AdminRecentRelease[] }) {
  return (
    <Section label="Недавно опубликовано">
      <Table minWidth="md:min-w-[480px]">
        <tbody>
          {releases.map((r) => (
            <Tr key={r.id}>
              <Td>
                <a
                  href={`/artists/${r.artistSlug}/releases/${r.id}`}
                  target="_blank"
                  className="hover:text-foreground/70 transition-colors"
                >
                  {r.title}
                </a>
              </Td>
              <Td label="Артист" tone="muted" className="text-xs">
                <a
                  href={`/artists/${r.artistSlug}`}
                  target="_blank"
                  className="hover:text-foreground transition-colors"
                >
                  {r.artistName}
                </a>
              </Td>
              <Td label="Тип" tone="faint" mono>{r.type}</Td>
              <Td label="Дата" align="right" tone="faint" mono>
                {new Date(r.updatedAt).toLocaleDateString('ru-RU')}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
}

