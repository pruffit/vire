import { getAdminDailyPlays, getAdminTopTracks, getAdminTopArtists } from '@vire/db';
import type { AdminDailyPlays, AdminTopTrack, AdminTopArtist } from '@vire/db';
import { PageHeader, Section, Panel, EmptyState } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const [daily, topTracks, topArtists] = await Promise.all([
    getAdminDailyPlays(14),
    getAdminTopTracks(30, 10),
    getAdminTopArtists(30, 10),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Аналитика платформы" />

      <DailyChart daily={daily} />

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <TopTracks tracks={topTracks} />
        <TopArtists artists={topArtists} />
      </div>
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
        <div className="flex items-end gap-1.5 h-36">
          {daily.map((d) => {
            const h = Math.max(2, Math.round((d.plays / max) * 100));
            const date = new Date(`${d.day}T00:00:00`);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group">
                <span className="text-[10px] font-mono text-foreground/45 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.plays}
                </span>
                <div
                  className="w-full rounded-sm bg-foreground/25 group-hover:bg-foreground/50 transition-colors"
                  style={{ height: `${h}%` }}
                  title={`${d.day}: ${d.plays} прослушиваний, ${d.listeners} слушателей`}
                />
                <span className="text-[10px] font-mono text-foreground/30 tabular-nums">
                  {date.getDate()}
                </span>
              </div>
            );
          })}
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
