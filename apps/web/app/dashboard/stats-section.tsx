import type { ArtistPlayStats } from '@vire/db';
import { formatListenTime } from '@/lib/format';

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1 rounded-full bg-white/10 overflow-hidden w-full">
      <div
        className="h-full rounded-full bg-white/40 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatsSection({ stats }: { stats: ArtistPlayStats }) {
  const { tracks, totalPlays, totalPlays7d } = stats;
  const maxPlays = tracks[0]?.totalPlays ?? 0;

  if (totalPlays === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Статистика</h2>
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <p className="text-sm text-white/40">Прослушиваний пока нет.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Статистика</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <span className="text-xs text-white/40 uppercase tracking-wider">Всего</span>
          <span className="text-2xl font-semibold tabular-nums">{totalPlays.toLocaleString('ru-RU')}</span>
          <span className="text-xs text-white/30">прослушиваний</span>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <span className="text-xs text-white/40 uppercase tracking-wider">7 дней</span>
          <span className="text-2xl font-semibold tabular-nums">{totalPlays7d.toLocaleString('ru-RU')}</span>
          <span className="text-xs text-white/30">прослушиваний</span>
        </div>
      </div>

      {/* Top tracks */}
      {tracks.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 flex flex-col gap-1">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Топ треков</p>
          <div className="flex flex-col gap-3">
            {tracks.map((t, i) => (
              <div key={t.trackId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs text-white/25 tabular-nums shrink-0 w-4">{i + 1}</span>
                    <span className="text-sm truncate">{t.trackTitle}</span>
                    <span className="text-xs text-white/30 truncate hidden sm:block">{t.releaseTitle}</span>
                  </div>
                  <div className="flex items-baseline gap-3 shrink-0">
                    <span className="text-xs text-white/30 tabular-nums">{formatListenTime(t.totalListenedSec)}</span>
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
    </section>
  );
}
