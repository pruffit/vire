import {
  getAdminDailyPlays, getAdminTopTracks, getAdminTopArtists, getPlatformMetricsHistory,
} from '@vire/db';
import type {
  AdminDailyPlays, AdminTopTrack, AdminTopArtist, PlatformMetricsDay,
} from '@vire/db';
import { PageHeader, Section, SectionLabel, Panel, EmptyState, FilterTabs } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const HISTORY_PERIODS = [30, 90, 180] as const;
type HistoryDays = (typeof HISTORY_PERIODS)[number];

function parseDays(raw: string | undefined): HistoryDays {
  const n = Number(raw);
  return (HISTORY_PERIODS as readonly number[]).includes(n) ? (n as HistoryDays) : 30;
}

type Props = { searchParams: Promise<{ days?: string }> };

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const days = parseDays((await searchParams).days);
  const [daily, topTracks, topArtists, history] = await Promise.all([
    getAdminDailyPlays(14),
    getAdminTopTracks(30, 10),
    getAdminTopArtists(30, 10),
    getPlatformMetricsHistory(days),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Аналитика платформы" />

      <DailyChart daily={daily} />

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <TopTracks tracks={topTracks} />
        <TopArtists artists={topArtists} />
      </div>

      <PlatformHistory history={history} days={days} />
    </div>
  );
}

// ─── Динамика по дням ──────────────────────────────────────────────────────

function DailyChart({ daily }: { daily: AdminDailyPlays[] }) {
  const max = Math.max(1, ...daily.map((d) => d.plays));
  const total = daily.reduce((s, d) => s + d.plays, 0);

  return (
    <Section
      label="Прослушивания · 14 дней"
      action={
        <span className="font-mono text-xs text-foreground/30 tabular-nums">
          {total.toLocaleString('ru-RU')} всего
        </span>
      }
    >
      <Panel className="p-5">
        {/* h-36 задаёт явную высоту ряда — иначе height:% столбцов схлопывается */}
        <div className="flex items-end gap-1.5 h-36">
          {daily.map((d) => {
            const h = d.plays === 0 ? 2 : Math.max(6, Math.round((d.plays / max) * 100));
            return (
              <div
                key={d.day}
                className="group relative flex-1 h-full flex items-end min-w-0"
                title={`${d.day}: ${d.plays} прослушиваний, ${d.listeners} слушателей`}
              >
                <div
                  className="w-full rounded-sm bg-foreground/30 group-hover:bg-foreground/55 transition-colors"
                  style={{ height: `${h}%` }}
                />
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-foreground/60 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.plays}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {daily.map((d) => (
            <span key={d.day} className="flex-1 text-center text-[10px] font-mono text-foreground/30 tabular-nums">
              {new Date(`${d.day}T00:00:00`).getDate()}
            </span>
          ))}
        </div>
      </Panel>
    </Section>
  );
}

// ─── Топ треков ────────────────────────────────────────────────────────────

function TopTracks({ tracks }: { tracks: AdminTopTrack[] }) {
  const max = Math.max(1, ...tracks.map((t) => t.plays));
  return (
    <Section label="Топ треков · 30 дней">
      {tracks.length === 0 ? (
        <Panel>
          <EmptyState title="Пока нет прослушиваний" />
        </Panel>
      ) : (
        <div className="rounded-xl border border-foreground/10 overflow-hidden">
          {tracks.map((t, i) => (
            <div key={t.id} className="relative border-b border-foreground/[0.06] last:border-0">
              <div
                className="absolute inset-y-0 left-0 bg-foreground/[0.05]"
                style={{ width: `${(t.plays / max) * 100}%` }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-right text-xs font-mono text-foreground/30 tabular-nums shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={`/artists/${t.artistSlug}/releases/${t.releaseId}/tracks/${t.id}`}
                    target="_blank"
                    className="block text-sm text-foreground/85 hover:text-foreground truncate transition-colors"
                  >
                    {t.title}
                  </a>
                  <span className="block text-xs text-foreground/35 truncate">{t.artistName}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-sm tabular-nums text-foreground/75">{t.plays.toLocaleString('ru-RU')}</span>
                  <span className="block text-[10px] text-foreground/30 tabular-nums">{t.listeners} слуш.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Топ артистов ──────────────────────────────────────────────────────────

function TopArtists({ artists }: { artists: AdminTopArtist[] }) {
  const max = Math.max(1, ...artists.map((a) => a.plays));
  return (
    <Section label="Топ артистов · 30 дней">
      {artists.length === 0 ? (
        <Panel>
          <EmptyState title="Пока нет прослушиваний" />
        </Panel>
      ) : (
        <div className="rounded-xl border border-foreground/10 overflow-hidden">
          {artists.map((a, i) => (
            <div key={a.id} className="relative border-b border-foreground/[0.06] last:border-0">
              <div
                className="absolute inset-y-0 left-0 bg-foreground/[0.05]"
                style={{ width: `${(a.plays / max) * 100}%` }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-right text-xs font-mono text-foreground/30 tabular-nums shrink-0">{i + 1}</span>
                <a
                  href={`/artists/${a.slug}`}
                  target="_blank"
                  className="flex-1 min-w-0 text-sm text-foreground/85 hover:text-foreground truncate transition-colors"
                >
                  {a.name}
                </a>
                <div className="text-right shrink-0">
                  <span className="block text-sm tabular-nums text-foreground/75">{a.plays.toLocaleString('ru-RU')}</span>
                  <span className="block text-[10px] text-foreground/30 tabular-nums">{a.listeners} слуш.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── История платформы ─────────────────────────────────────────────────────

function PlatformHistory({ history, days }: { history: PlatformMetricsDay[]; days: HistoryDays }) {
  return (
    <Section
      label="История платформы"
      action={
        <FilterTabs
          tabs={HISTORY_PERIODS.map((d) => ({
            href: `?days=${d}`,
            label: `${d}д`,
            active: d === days,
          }))}
        />
      }
    >
      {history.length === 0 ? (
        <Panel>
          <EmptyState title="История ещё не набралась" hint="Первый снапшот появится после ночного прогона джобы" />
        </Panel>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <GrowthChart title="Пользователи" points={history} field="users" />
          <GrowthChart title="Лайки" points={history} field="likesTotal" />
          <GrowthChart title="Подписки" points={history} field="followsTotal" />
        </div>
      )}
    </Section>
  );
}

function GrowthChart({
  title,
  points,
  field,
}: {
  title: string;
  points: PlatformMetricsDay[];
  field: 'users' | 'likesTotal' | 'followsTotal';
}) {
  const values = points.map((p) => p[field]);
  const max = Math.max(1, ...values);
  const latest = values.at(-1) ?? 0;
  const first = points[0];
  const last = points.at(-1);

  return (
    <Panel className="p-5 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>{title}</SectionLabel>
        <span className="font-mono text-sm text-foreground/75 tabular-nums">{latest.toLocaleString('ru-RU')}</span>
      </div>
      <div className="mt-3 flex items-end gap-px h-24">
        {points.map((p, i) => {
          const v = p[field];
          const h = v === 0 ? 2 : Math.max(4, Math.round((v / max) * 100));
          return (
            <div
              key={p.day}
              className="group relative flex-1 h-full flex items-end min-w-0"
              title={`${p.day}: ${v.toLocaleString('ru-RU')}`}
            >
              <div
                className="w-full rounded-[1px] bg-foreground/30 group-hover:bg-foreground/55 transition-colors"
                style={{ height: `${h}%` }}
              />
              {i === points.length - 1 && (
                <span className="absolute -top-4 right-0 text-[10px] font-mono text-foreground/60 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {v}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {first && last && (
        <div className="mt-1.5 flex justify-between text-[10px] font-mono text-foreground/30 tabular-nums">
          <span>{first.day}</span>
          <span>{last.day}</span>
        </div>
      )}
    </Panel>
  );
}
