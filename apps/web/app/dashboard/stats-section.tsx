import type { ArtistPlayStats, ArtistRelistenStats } from '@vire/db';
import { formatListenTime } from '@/lib/format';
import { Panel } from '@/components/ui-kit';

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
      <div className="h-full rounded-full bg-foreground/40 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function CardHeader({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/40">{title}</p>
      {meta && <p className="text-xs text-foreground/30">{meta}</p>}
    </div>
  );
}

/** Топ треков артиста по прослушиваниям (с долей прослушанного времени). */
export function TopTracksCard({ stats }: { stats: ArtistPlayStats }) {
  const { tracks } = stats;
  const maxPlays = tracks[0]?.totalPlays ?? 0;

  return (
    <Panel className="flex flex-col p-5">
      <CardHeader title="Топ треков" />
      {tracks.length === 0 ? (
        <p className="text-sm text-foreground/40">Прослушиваний пока нет.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tracks.map((t, i) => (
            <div key={t.trackId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 tabular-nums text-xs text-foreground/25">{i + 1}</span>
                  <span className="truncate text-sm">{t.trackTitle}</span>
                  <span className="hidden truncate text-xs text-foreground/30 sm:block">{t.releaseTitle}</span>
                </div>
                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="tabular-nums text-xs text-foreground/30">{formatListenTime(t.totalListenedSec)}</span>
                  <span className="w-12 text-right text-sm font-medium tabular-nums">
                    {t.totalPlays.toLocaleString('ru-RU')}
                  </span>
                </div>
              </div>
              <MiniBar value={t.totalPlays} max={maxPlays} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Возвращаются — слушатели, вернувшиеся к треку в разные дни (сигнал сильнее лайка). */
export function RelistenCard({ relisten }: { relisten: ArtistRelistenStats }) {
  const returned = relisten.tracks.filter((t) => t.returningListeners > 0);

  return (
    <Panel className="flex flex-col p-5">
      <CardHeader
        title="Возвращаются"
        meta={
          relisten.totalReturning > 0
            ? `${relisten.totalReturning.toLocaleString('ru-RU')} ${pluralListeners(relisten.totalReturning)}`
            : undefined
        }
      />
      {returned.length === 0 ? (
        <p className="text-sm text-foreground/40">
          Пока никто не возвращался к трекам в разные дни. Это сильный сигнал — он появится, когда
          слушатели начнут переслушивать.
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
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-sm">{t.trackTitle}</span>
                    <span className="hidden truncate text-xs text-foreground/30 sm:block">{t.releaseTitle}</span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3">
                    <span className="tabular-nums text-xs text-foreground/30">{rate}%</span>
                    <span className="text-sm font-medium tabular-nums">
                      {t.returningListeners.toLocaleString('ru-RU')}
                      <span className="font-normal text-foreground/30">
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
    </Panel>
  );
}

function pluralListeners(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'слушатель';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'слушателя';
  return 'слушателей';
}
