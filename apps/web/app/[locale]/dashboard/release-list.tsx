import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { TrackStatus, ReleaseStatus, ReleaseType } from '@vire/core';
import { PublishButton } from './publish-button';
import { Panel, ReleaseStatusBadge } from '@/components/ui-kit';
import { Icon } from '@/components/icon';
import { LivePulse } from '@/components/live-pulse';

type Translator = Awaited<ReturnType<typeof getTranslations>>;
type Formatter = Awaited<ReturnType<typeof getFormatter>>;

// Date-free типы для безопасной RSC-сериализации
export interface DashboardTrack {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: TrackStatus;
}

export interface DashboardRelease {
  id: string;
  title: string;
  type: ReleaseType;
  status: ReleaseStatus;
  coverUrl: string | null;
  releaseDate: string | null;
  tracks: DashboardTrack[];
}

function TrackHealth({ tracks, t }: { tracks: DashboardTrack[]; t: Translator }) {
  if (tracks.length === 0) {
    return <span className="text-xs text-foreground/30">{t('dashboard.releaseList.trackHealth.none')}</span>;
  }
  const processing = tracks.filter((t) => t.status === 'PROCESSING').length;
  const problem = tracks.filter((t) => t.status === 'BLOCKED' || t.status === 'FAILED').length;
  const ready = tracks.filter((t) => t.status === 'READY').length;

  if (processing > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
        <LivePulse small className="text-amber-400" />
        {t('dashboard.releaseList.trackHealth.processing', { count: processing })}
      </span>
    );
  }
  if (problem > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" />
        {t('dashboard.releaseList.trackHealth.problem', { count: problem })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground/35">
      <Icon name="check" size={12} className="text-emerald-400/80" />
      {t('dashboard.releaseList.trackHealth.ready', { count: ready })}
    </span>
  );
}

function ReleaseCover({ release }: { release: DashboardRelease }) {
  if (release.coverUrl) {
    return (
      <Image
        src={release.coverUrl}
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-md object-cover"
      />
    );
  }
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-foreground/[0.06] text-foreground/25">
      <Icon name="music" size={20} />
    </span>
  );
}

function ReleaseCard({
  data,
  artistSlug,
  t,
  format,
}: {
  data: DashboardRelease;
  artistSlug: string;
  t: Translator;
  format: Formatter;
}) {
  const editHref = `/dashboard/releases/${data.id}`;
  return (
    <Panel className="group flex flex-col gap-3 p-4 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-3">
        <Link href={editHref} className="shrink-0" aria-label={t('dashboard.releaseList.manageAria', { title: data.title })}>
          <ReleaseCover release={data} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={editHref} className="truncate font-medium transition-colors hover:text-foreground/70">
              {data.title}
            </Link>
            {data.status === 'PUBLISHED' && (
              <a
                href={`/artists/${artistSlug}/releases/${data.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 text-foreground/30 transition-colors hover:text-foreground/60"
                title={t('dashboard.releaseList.openPublicPage')}
              >
                <Icon name="external-link" size={14} />
              </a>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <ReleaseStatusBadge status={data.status} />
            <span className="font-mono text-xs text-foreground/45">{data.type}</span>
            <span className="font-mono text-xs text-foreground/45">{t('common.trackCountShort', { count: data.tracks.length })}</span>
            {data.status === 'SCHEDULED' && data.releaseDate && (
              <span className="font-mono text-xs text-foreground/45">
                {format.dateTime(new Date(data.releaseDate), { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {data.status === 'DRAFT' && <PublishButton releaseId={data.id} releaseDate={data.releaseDate} />}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-foreground/[0.06] pt-2.5">
        <TrackHealth tracks={data.tracks} t={t} />
        <Link
          href={editHref}
          className="inline-flex items-center gap-1.5 text-xs text-foreground/50 transition-colors hover:text-foreground"
        >
          <Icon name="edit-2" size={13} /> {t('dashboard.releaseList.manage')}
        </Link>
      </div>
    </Panel>
  );
}

export async function ReleaseList({ releases, artistSlug }: { releases: DashboardRelease[]; artistSlug: string }) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {releases.map((r) => (
        <ReleaseCard key={r.id} data={r} artistSlug={artistSlug} t={t} format={format} />
      ))}
    </div>
  );
}
