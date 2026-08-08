import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { listSmartLinks } from '@vire/db';
import { SmartLinkList, type SmartLinkRow } from './smart-link-list';
import { DashboardPageHeader } from '@/components/ui-kit';

export const metadata = { title: 'Смартлинки' };
export const dynamic = 'force-dynamic';

export default async function DashboardLinksPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/dashboard/links', locale });

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) return redirect({ href: '/dashboard', locale });

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
    <div className="flex flex-col gap-8">
      <DashboardPageHeader
        backHref="/dashboard"
        title="Смартлинки"
        subtitle="Красивые страницы релизов со ссылками на стриминги и соцсети. Работают и без публикации музыки на VireMusic."
      />

      <SmartLinkList items={rows} artistSlug={artist.slug} />
    </div>
  );
}
