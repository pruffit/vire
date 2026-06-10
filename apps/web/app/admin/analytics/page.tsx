import { getAdminDailyPlays, getAdminTopTracks, getAdminTopArtists } from '@vire/db';
import type { AdminDailyPlays, AdminTopTrack, AdminTopArtist } from '@vire/db';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const [daily, topTracks, topArtists] = await Promise.all([
    getAdminDailyPlays(14),
    getAdminTopTracks(30, 10),
    getAdminTopArtists(30, 10),
  ]);

  return (
    <div className="flex flex-col gap-10 max-w-4xl">
      <h1 className="text-xl font-semibold">Аналитика платформы</h1>

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
    <section>
      <p className="text-xs text-white/35 font-mono mb-3">
        Прослушивания · 14 дней <span className="text-white/20 ml-2">{total.toLocaleString('ru-RU')} всего</span>
      </p>
      <div className="rounded-xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-end gap-1.5 h-36">
          {daily.map((d) => {
            const h = Math.max(2, Math.round((d.plays / max) * 100));
            const date = new Date(`${d.day}T00:00:00`);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group">
                <span className="text-[10px] font-mono text-white/40 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.plays}
                </span>
                <div
                  className="w-full rounded-sm bg-white/25 group-hover:bg-white/50 transition-colors"
                  style={{ height: `${h}%` }}
                  title={`${d.day}: ${d.plays} прослушиваний, ${d.listeners} слушателей`}
                />
                <span className="text-[10px] font-mono text-white/25 tabular-nums">
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Топ треков ────────────────────────────────────────────────────────────

function TopTracks({ tracks }: { tracks: AdminTopTrack[] }) {
  const max = Math.max(1, ...tracks.map((t) => t.plays));
  return (
    <section>
      <p className="text-xs text-white/35 font-mono mb-3">Топ треков · 30 дней</p>
      {tracks.length === 0 ? (
        <p className="text-sm text-white/30">Пока нет прослушиваний.</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {tracks.map((t, i) => (
            <div key={t.id} className="relative border-b border-white/5 last:border-0">
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.04]"
                style={{ width: `${(t.plays / max) * 100}%` }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-right text-xs font-mono text-white/25 tabular-nums shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={`/artists/${t.artistSlug}/releases/${t.releaseId}/tracks/${t.id}`}
                    target="_blank"
                    className="block text-sm text-white/80 hover:text-white truncate transition-colors"
                  >
                    {t.title}
                  </a>
                  <span className="block text-xs text-white/30 truncate">{t.artistName}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-sm tabular-nums text-white/70">{t.plays.toLocaleString('ru-RU')}</span>
                  <span className="block text-[10px] text-white/25 tabular-nums">{t.listeners} слуш.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Топ артистов ──────────────────────────────────────────────────────────

function TopArtists({ artists }: { artists: AdminTopArtist[] }) {
  const max = Math.max(1, ...artists.map((a) => a.plays));
  return (
    <section>
      <p className="text-xs text-white/35 font-mono mb-3">Топ артистов · 30 дней</p>
      {artists.length === 0 ? (
        <p className="text-sm text-white/30">Пока нет прослушиваний.</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {artists.map((a, i) => (
            <div key={a.id} className="relative border-b border-white/5 last:border-0">
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.04]"
                style={{ width: `${(a.plays / max) * 100}%` }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-right text-xs font-mono text-white/25 tabular-nums shrink-0">{i + 1}</span>
                <a
                  href={`/artists/${a.slug}`}
                  target="_blank"
                  className="flex-1 min-w-0 text-sm text-white/80 hover:text-white truncate transition-colors"
                >
                  {a.name}
                </a>
                <div className="text-right shrink-0">
                  <span className="block text-sm tabular-nums text-white/70">{a.plays.toLocaleString('ru-RU')}</span>
                  <span className="block text-[10px] text-white/25 tabular-nums">{a.listeners} слуш.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
