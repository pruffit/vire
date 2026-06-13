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

const STATUS_LABEL: Record<TrackStatus, string> = {
  PROCESSING: 'обрабатывается',
  READY: 'готов',
  BLOCKED: 'заблокирован',
};

const RELEASE_STATUS_LABEL: Record<ReleaseStatus, string> = {
  DRAFT: 'черновик',
  SCHEDULED: 'запланирован',
  PUBLISHED: 'опубликован',
  ARCHIVED: 'архив',
};

const RELEASE_STATUS_COLOR: Record<ReleaseStatus, string> = {
  DRAFT: 'text-white/40',
  SCHEDULED: 'text-blue-400',
  PUBLISHED: 'text-green-400',
  ARCHIVED: 'text-white/20',
};

const STATUS_COLOR: Record<TrackStatus, string> = {
  PROCESSING: 'text-yellow-400',
  READY: 'text-green-400',
  BLOCKED: 'text-red-400',
};

function TrackRow({ track }: { track: DashboardTrack }) {
  const mins = track.durationSec ? Math.floor(track.durationSec / 60) : null;
  const secs = track.durationSec ? String(track.durationSec % 60).padStart(2, '0') : null;

  return (
    <div className="flex items-center gap-3 py-2 text-sm border-b border-white/5 last:border-0">
      <span className="w-6 text-right text-white/30 shrink-0">{track.trackNumber}</span>
      <span className="flex-1 truncate">{track.title}</span>
      {mins !== null && (
        <span className="text-white/40 shrink-0">{mins}:{secs}</span>
      )}
      <span className={`shrink-0 text-xs ${STATUS_COLOR[track.status]}`}>
        {STATUS_LABEL[track.status]}
      </span>
    </div>
  );
}

function ReleaseCard({ data, artistSlug }: { data: DashboardRelease; artistSlug: string }) {
  const { tracks } = data;
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <a
              href={`/dashboard/releases/${data.id}`}
              className="font-medium hover:text-white/70 transition-colors"
            >
              {data.title}
            </a>
            {data.status === 'PUBLISHED' && (
              <a
                href={`/artists/${artistSlug}/releases/${data.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
                title="Открыть публичную страницу"
              >
                ↗
              </a>
            )}
          </div>
          <p className={`text-sm ${RELEASE_STATUS_COLOR[data.status]}`}>
            {data.type} · {RELEASE_STATUS_LABEL[data.status]}
            {data.status === 'SCHEDULED' && data.releaseDate && (
              <> · {new Date(data.releaseDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</>
            )}
            {' '}· {tracks.length} тр.
          </p>
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
        <p className="text-sm text-white/30">Треков пока нет</p>
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
              <p className="text-white/50 mt-1 text-sm">
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
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/artists/${artist.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-3 py-1.5 rounded-md text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 transition-colors"
              >
                Страница артиста ↗
              </a>
              <Link
                href="/dashboard/posts"
                className="text-sm px-3 py-1.5 rounded-md text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 transition-colors"
              >
                Анонсы
              </Link>
              <a
                href="/dashboard/profile"
                className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
              >
                Профиль
              </a>
            </div>
          )}
        </div>

        {!artist ? (
          <p className="text-white/50">
            У тебя нет профиля артиста. Обратись к администратору для создания.
          </p>
        ) : (
          <>
            {playStats && <StatsSection stats={playStats} relisten={relistenStats} />}

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">
                  Релизы
                  <span className="ml-2 text-sm text-white/30 font-normal">{releases.length}</span>
                </h2>
                <Link
                  href="/dashboard/releases/new"
                  className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
                >
                  + Создать
                </Link>
              </div>
              {releases.length === 0 ? (
                <p className="text-white/40 text-sm">Нет релизов</p>
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
