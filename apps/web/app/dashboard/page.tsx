import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository, getArtistPlayStats, getArtistRelistenStats } from '@vire/db';
import type { TrackStatus, ReleaseStatus, ReleaseType } from '@vire/core';
import { getActiveArtistForPage, listUserArtists } from '@/lib/active-artist';
import { PublishButton } from './publish-button';
import { StatsSection } from './stats-section';
import { LiveNow } from './live-now';
import { ArtistSwitcher } from './artist-switcher';
import { ReleaseStatusBadge, TrackStatusBadge, btnGhost, btnPrimary } from '@/components/ui-kit';
import { Icon } from '@/components/icon';

export const dynamic = 'force-dynamic';

// Date-free types for safe RSC prop serialization
interface DashboardTrack {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: TrackStatus;
}

interface DashboardRelease {
  id: string;
  title: string;
  type: ReleaseType;
  status: ReleaseStatus;
  coverUrl: string | null;
  releaseDate: string | null;
  tracks: DashboardTrack[];
}

function TrackRow({ track }: { track: DashboardTrack }) {
  const mins = track.durationSec ? Math.floor(track.durationSec / 60) : null;
  const secs = track.durationSec ? String(track.durationSec % 60).padStart(2, '0') : null;

  return (
    <div className="flex items-center gap-3 py-2 text-sm border-b border-foreground/[0.06] last:border-0">
      <span className="w-6 text-right text-foreground/30 shrink-0 font-mono text-xs tabular-nums">{track.trackNumber}</span>
      <span className="flex-1 truncate">{track.title}</span>
      {mins !== null && (
        <span className="text-foreground/40 shrink-0 font-mono text-xs tabular-nums">{mins}:{secs}</span>
      )}
      <span className="shrink-0">
        <TrackStatusBadge status={track.status} />
      </span>
    </div>
  );
}

function ReleaseCard({ data, artistSlug }: { data: DashboardRelease; artistSlug: string }) {
  const { tracks } = data;
  return (
    <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 flex flex-col gap-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={`/dashboard/releases/${data.id}`}
              className="font-medium hover:text-foreground/70 transition-colors"
            >
              {data.title}
            </a>
            {data.status === 'PUBLISHED' && (
              <a
                href={`/artists/${artistSlug}/releases/${data.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-foreground/30 hover:text-foreground/60 transition-colors"
                title="Открыть публичную страницу"
              >
                <Icon name="external-link" size={14} />
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/45">
            <ReleaseStatusBadge status={data.status} />
            <span className="font-mono text-xs">{data.type}</span>
            {data.status === 'SCHEDULED' && data.releaseDate && (
              <span className="font-mono text-xs">
                {new Date(data.releaseDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            <span className="font-mono text-xs">{tracks.length} тр.</span>
          </div>
          {data.status === 'DRAFT' && (
            <PublishButton releaseId={data.id} releaseDate={data.releaseDate} />
          )}
        </div>
        {data.coverUrl && (
          <Image
            src={data.coverUrl}
            alt={data.title}
            width={48}
            height={48}
            className="w-12 h-12 rounded-md object-cover shrink-0"
          />
        )}
      </div>
      {tracks.length === 0 ? (
        <p className="text-sm text-foreground/30">Треков пока нет</p>
      ) : (
        <div>
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard');

  const [artist, allArtists] = await Promise.all([
    getActiveArtistForPage(session.user.id),
    listUserArtists(session.user.id),
  ]);

  const [rawReleases, playStats, relistenStats] = await Promise.all([
    artist ? new DrizzleReleaseRepository(db).findAllByArtist(artist.id) : Promise.resolve([]),
    artist ? getArtistPlayStats(artist.id) : Promise.resolve(null),
    artist ? getArtistRelistenStats(artist.id) : Promise.resolve(null),
  ]);

  const releases: DashboardRelease[] = rawReleases.map(({ release, tracks }) => ({
    id: release.id,
    title: release.title,
    type: release.type,
    status: release.status,
    coverUrl: release.coverUrl,
    releaseDate: release.releaseDate ? release.releaseDate.toISOString() : null,
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      trackNumber: t.trackNumber,
      durationSec: t.durationSec,
      status: t.status,
    })),
  }));

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-10">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">Dashboard</h1>
              {artist && <LiveNow />}
            </div>
            {artist && (
              <p className="text-foreground/50 mt-1 text-sm">
                @{artist.slug} · {artist.name}
              </p>
            )}
            {artist && allArtists.length > 1 && (
              <div className="mt-3">
                <ArtistSwitcher
                  activeId={artist.id}
                  artists={allArtists.map((a) => ({ id: a.id, name: a.name, slug: a.slug }))}
                />
              </div>
            )}
          </div>
          {artist && (
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/artists/${artist.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btnGhost}
              >
                Страница артиста <Icon name="external-link" size={14} className="ml-1.5" />
              </a>
              <Link href="/dashboard/posts" className={btnGhost}>
                Анонсы
              </Link>
              <Link href="/dashboard/links" className={btnGhost}>
                Смартлинки
              </Link>
              <a href="/dashboard/profile" className={btnGhost}>
                Профиль
              </a>
            </div>
          )}
        </div>

        {!artist ? (
          <p className="text-foreground/50">
            У тебя нет профиля артиста. Обратись к администратору для создания.
          </p>
        ) : (
          <>
            {playStats && <StatsSection stats={playStats} relisten={relistenStats} />}

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">
                  Релизы
                  <span className="ml-2 text-sm text-foreground/30 font-normal tabular-nums">{releases.length}</span>
                </h2>
                <Link href="/dashboard/releases/new" className={btnPrimary}>
                  + Создать
                </Link>
              </div>
              {releases.length === 0 ? (
                <p className="text-foreground/40 text-sm">Нет релизов</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {releases.map((r) => (
                    <ReleaseCard key={r.id} data={r} artistSlug={artist.slug} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

      </div>
    </div>
  );
}
