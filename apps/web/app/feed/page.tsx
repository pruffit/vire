import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getFeed } from '@vire/db';
import type { FeedRelease } from '@vire/db';
import { releaseYear } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Лента — Vire',
};

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/feed');

  const releases = await getFeed(session.user.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Лента</h1>
        {releases.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {releases.length}
          </span>
        )}
      </header>

      {releases.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {releases.map((release) => (
            <FeedCard key={release.id} release={release} />
          ))}
        </div>
      )}
    </main>
  );
}

function FeedCard({ release }: { release: FeedRelease }) {
  const year = releaseYear(release.releaseDate);

  return (
    <Link
      href={`/artists/${release.artistSlug}/releases/${release.id}`}
      className="group flex items-center gap-4 py-4 hover:bg-accent/5 -mx-3 px-3 rounded-sm transition-colors"
    >
      {/* Cover */}
      <div className="relative w-14 h-14 shrink-0 rounded-sm overflow-hidden bg-muted">
        {release.coverUrl ? (
          <Image
            src={release.coverUrl}
            alt={release.title}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <NoteIcon />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
          {release.title}
        </p>
        <div className="flex items-center gap-2">
          {release.artistAvatarUrl ? (
            <Image
              src={release.artistAvatarUrl}
              alt={release.artistName}
              width={16}
              height={16}
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-mono text-muted-foreground">
              {release.artistName[0]?.toUpperCase()}
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {release.artistName}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="shrink-0 text-right space-y-1">
        <p className="text-xs font-mono text-muted-foreground">{release.type}</p>
        {year && (
          <p className="text-xs font-mono text-muted-foreground tabular-nums">{year}</p>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="py-24 text-center space-y-4">
      <p className="text-sm text-muted-foreground">
        Ты ещё ни на кого не подписан.
      </p>
      <Link
        href="/artists"
        className="inline-block text-sm underline underline-offset-2 hover:text-foreground text-muted-foreground transition-colors"
      >
        Найти артистов →
      </Link>
    </div>
  );
}

function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}
