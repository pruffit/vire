import type { ArtistPlayStats, ArtistRelistenStats } from '@vire/db';
import { formatListenTime } from '@/lib/format';
import { StatCard, MetricGrid } from '@/components/ui-kit';

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1 rounded-full bg-foreground/10 overflow-hidden w-full">
      <div
        className="h-full rounded-full bg-foreground/40 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatsSection({
  stats,
  relisten,
}: {
  stats: ArtistPlayStats;
  relisten?: ArtistRelistenStats | null;
}) {
  const { tracks, totalPlays, totalPlays7d } = stats;
  const maxPlays = tracks[0]?.totalPlays ?? 0;

  if (totalPlays === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Статистика</h2>
        <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-5">
          <p className="text-sm text-foreground/40">Прослушиваний пока нет.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Статистика</h2>

      {/* Summary cards */}
      <MetricGrid className="sm:grid-cols-2">
        <StatCard label="Всего" value={totalPlays} sub="прослушиваний" />
        <StatCard label="7 дней" value={totalPlays7d} sub="прослушиваний" />
      </MetricGrid>

      {/* Top tracks */}
      {tracks.length > 0 && (
        <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-5 flex flex-col gap-1">
          <p className="text-xs text-foreground/40 uppercase tracking-wider mb-3">Топ треков</p>
          <div className="flex flex-col gap-3">
            {tracks.map((t, i) => (
              <div key={t.trackId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs text-foreground/25 tabular-nums shrink-0 w-4">{i + 1}</span>
                    <span className="text-sm truncate">{t.trackTitle}</span>
                    <span className="text-xs text-foreground/30 truncate hidden sm:block">{t.releaseTitle}</span>
                  </div>
                  <div className="flex items-baseline gap-3 shrink-0">
                    <span className="text-xs text-foreground/30 tabular-nums">{formatListenTime(t.totalListenedSec)}</span>
                    <span className="text-sm font-medium tabular-nums w-12 text-right">
                      {t.totalPlays.toLocaleString('ru-RU')}
                    </span>
                  </div>
                </div>
                <MiniBar value={t.totalPlays} max={maxPlays} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Переслушивания — возвраты к треку (сигнал сильнее лайка) */}
      {relisten && <RelistenBlock relisten={relisten} />}
    </section>
  );
}

function RelistenBlock({ relisten }: { relisten: ArtistRelistenStats }) {
  const returned = relisten.tracks.filter((t) => t.returningListeners > 0);

  return (
    <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-5 flex flex-col gap-1">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs text-foreground/40 uppercase tracking-wider">Возвращаются</p>
        {relisten.totalReturning > 0 && (
          <p className="text-xs text-foreground/30">
            {relisten.totalReturning.toLocaleString('ru-RU')}{' '}
            {pluralListeners(relisten.totalReturning)}
          </p>
        )}
      </div>

      {returned.length === 0 ? (
        <p className="text-sm text-foreground/40">
          Пока никто не возвращался к трекам в разные дни. Это сильный сигнал — он
          появится, когда слушатели начнут переслушивать.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {returned.map((t) => {
            const rate = t.distinctListeners > 0
              ? Math.round((t.returningListeners / t.distinctListeners) * 100)
              : 0;
            return (
              <div key={t.trackId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm truncate">{t.trackTitle}</span>
                    <span className="text-xs text-foreground/30 truncate hidden sm:block">
                      {t.releaseTitle}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 shrink-0">
                    <span className="text-xs text-foreground/30 tabular-nums">{rate}%</span>
                    <span className="text-sm font-medium tabular-nums">
                      {t.returningListeners.toLocaleString('ru-RU')}
                      <span className="text-foreground/30 font-normal">
                        {' / '}{t.distinctListeners.toLocaleString('ru-RU')}
                      </span>
                    </span>
                  </div>
                </div>
                <MiniBar value={t.returningListeners} max={t.distinctListeners} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function pluralListeners(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'слушатель';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'слушателя';
  return 'слушателей';
}
