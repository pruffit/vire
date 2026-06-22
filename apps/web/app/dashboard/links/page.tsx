import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { listSmartLinks } from '@vire/db';
import { SmartLinkList, type SmartLinkRow } from './smart-link-list';
import { btnGhost } from '@/components/ui-kit';

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
        <div className="flex flex-col gap-1">
          <a href="/dashboard" className={`${btnGhost} self-start mb-2`}>← Дашборд</a>
          <h1 className="text-2xl font-semibold">Смартлинки</h1>
          <p className="text-sm text-foreground/40">
            Красивые страницы релизов со ссылками на стриминги и соцсети. Работают и без публикации музыки на Vire.
          </p>
        </div>

        <SmartLinkList items={rows} artistSlug={artist.slug} />
      </div>
    </div>
  );
}
