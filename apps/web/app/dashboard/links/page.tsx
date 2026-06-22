import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { listSmartLinks } from '@vire/db';
import { SmartLinkList, type SmartLinkRow } from './smart-link-list';
import { DashboardPageHeader } from '@/components/ui-kit';

export const metadata = { title: 'Смартлинки' };
export const dynamic = 'force-dynamic';

export default async function DashboardLinksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/links');

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) redirect('/dashboard');

  const links = await listSmartLinks(artist.id);
  const rows: SmartLinkRow[] = links.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    coverUrl: l.coverUrl,
    isPublished: l.isPublished,
    linkCount: l.links.length,
  }));

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
        <DashboardPageHeader
          backHref="/dashboard"
          title="Смартлинки"
          subtitle="Красивые страницы релизов со ссылками на стриминги и соцсети. Работают и без публикации музыки на Vire."
        />

        <SmartLinkList items={rows} artistSlug={artist.slug} />
      </div>
    </div>
  );
}
