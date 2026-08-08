import { Link, redirect } from '@/i18n/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';
import { IncomingRequests } from '@/components/friends/incoming-requests';
import { UserSearch } from '@/components/friends/user-search';
import { MarkRequestsSeen } from '@/components/friends/mark-requests-seen';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';
import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = { title: 'Друзья' };
export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/friends', locale });

  const svc = friendshipService();
  const [incoming, friends] = await Promise.all([
    svc.listIncoming(session.user.id),
    svc.listFriends(session.user.id),
  ]);

  return (
    <PageContainer spaceY="14">
      <MarkRequestsSeen />
      <h1 className="text-2xl font-semibold tracking-tight">Друзья</h1>

      <UserSearch />

      <IncomingRequests initial={incoming} />

      <Section title="Друзья" count={friends.length}>
        {friends.length === 0 ? (
          <EmptyState title="Пока нет друзей" hint="Поделись ссылкой на профиль" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {friends.map((friend) => (
              <Link
                key={friend.id}
                href={`/u/${friend.id}`}
                className="group flex items-center gap-3 rounded-md border border-border/40 bg-card p-3 transition-colors hover:bg-accent/5"
              >
                {friend.image ? (
                  <Image src={friend.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                    {(friend.name ?? '?')[0]?.toUpperCase()}
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-foreground transition-colors">
                  {friend.name ?? 'Слушатель'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </PageContainer>
  );
}
