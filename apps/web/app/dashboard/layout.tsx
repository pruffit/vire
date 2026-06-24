import { redirect } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/auth';
import { getActiveArtistForPage, listUserArtists } from '@/lib/active-artist';
import { DashboardNav } from './dashboard-nav';
import { ArtistSwitcher } from './artist-switcher';
import { Icon } from '@/components/icon';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard');

  const [artist, allArtists] = await Promise.all([
    getActiveArtistForPage(session.user.id),
    listUserArtists(session.user.id),
  ]);

  return (
    <div className="h-full bg-background text-foreground flex flex-col md:flex-row">
      {/* Сайдбар на десктопе, горизонтальный топ-бар на мобилке. Второй
          нейтральный слой (чуть светлее контента) — как в backoffice. */}
      <aside className="shrink-0 border-b border-foreground/10 md:flex md:w-60 md:flex-col md:border-b-0 md:border-r md:bg-foreground/[0.015]">
        {artist ? (
          <div className="hidden items-center gap-3 px-4 pb-4 pt-5 md:flex">
            {artist.avatarUrl ? (
              <Image
                src={artist.avatarUrl}
                alt={artist.name}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/10 font-mono text-sm">
                {artist.name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{artist.name}</p>
              <p className="truncate font-mono text-xs text-foreground/40">@{artist.slug}</p>
            </div>
          </div>
        ) : (
          <div className="hidden px-4 pb-4 pt-5 md:block">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35">
              Дашборд
            </span>
          </div>
        )}

        <DashboardNav hasArtist={!!artist} />

        {artist && (
          <div className="mt-auto hidden flex-col gap-3 border-t border-foreground/10 px-3 py-4 md:flex">
            {allArtists.length > 1 && (
              <ArtistSwitcher
                activeId={artist.id}
                artists={allArtists.map((a) => ({ id: a.id, name: a.name, slug: a.slug }))}
              />
            )}
            <a
              href={`/artists/${artist.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 text-xs text-foreground/45 transition-colors hover:text-foreground"
            >
              Открыть страницу <Icon name="external-link" size={13} />
            </a>
          </div>
        )}
      </aside>

      {/* Контент — на всю ширину рабочей области; страницы сами ограничивают
          ширину форм. Единственная скролл-область дашборда. */}
      <main data-scroll-area className="flex-1 min-w-0 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
