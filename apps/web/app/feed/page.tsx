import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getFeed } from '@vire/db';
import { ReleaseQuickLook } from '@/components/release-quick-look';

export const metadata: Metadata = {
  title: 'Лента',
};

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/feed');

  const releases = await getFeed(session.user.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <FadeUp>
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Лента</h1>
          {releases.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {releases.length}
            </span>
          )}
        </header>
      </FadeUp>

      {releases.length === 0 ? (
        <EmptyState />
      ) : (
        <Stagger step={0.04} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {releases.map((release) => (
            <StaggerItem key={release.id}>
              <ReleaseQuickLook release={release} showArtist />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="py-24 flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center opacity-40">
        <NoteIcon />
      </div>
      <p className="text-sm text-muted-foreground">
        Ты ещё ни на кого не подписан.
      </p>
      <Link
        href="/artists"
        className="text-sm underline underline-offset-2 hover:text-foreground text-muted-foreground transition-colors"
      >
        Найти артистов →
      </Link>
    </div>
  );
}

function NoteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}
