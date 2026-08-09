import { getFormatter, getTranslations } from 'next-intl/server';
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
      <p className="label-mono text-foreground/40">{title}</p>
      {meta && <p className="text-xs text-foreground/30">{meta}</p>}
    </div>
  );
}

export async function TopTracksCard({ stats }: { stats: ArtistPlayStats }) {
  const { tracks } = stats;
  const maxPlays = tracks[0]?.totalPlays ?? 0;
  const [format, t] = await Promise.all([getFormatter(), getTranslations()]);
  const listenTimeUnit = t.raw('common.listenTimeUnit') as { seconds: string; minutes: string; hours: string };

  return (
    <Panel className="flex flex-col p-5">
      <CardHeader title={t('dashboard.stats.topTracks.title')} />
      {tracks.length === 0 ? (
        <p className="text-sm text-foreground/40">{t('dashboard.stats.topTracks.empty')}</p>
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
                  <span className="tabular-nums text-xs text-foreground/30">{formatListenTime(t.totalListenedSec, listenTimeUnit)}</span>
                  <span className="w-12 text-right text-sm font-medium tabular-nums">
                    {format.number(t.totalPlays)}
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
export async function RelistenCard({ relisten }: { relisten: ArtistRelistenStats }) {
  const returned = relisten.tracks.filter((t) => t.returningListeners > 0);
  const [format, t] = await Promise.all([getFormatter(), getTranslations('dashboard.stats.relisten')]);

  return (
    <Panel className="flex flex-col p-5">
      <CardHeader
        title={t('title')}
        meta={
          relisten.totalReturning > 0
            ? t('listenerCount', { count: relisten.totalReturning })
            : undefined
        }
      />
      {returned.length === 0 ? (
        <p className="text-sm text-foreground/40">
          {t('empty')}
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
                      {format.number(t.returningListeners)}
                      <span className="font-normal text-foreground/30">
                        {' / '}{format.number(t.distinctListeners)}
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
