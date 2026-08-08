import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { getSmartLinkById, getReleaseOptions } from '@vire/db';
import { SmartLinkForm, type SmartLinkInitial } from '../smart-link-form';
import { DashboardPageHeader } from '@/components/ui-kit';
import { Icon } from '@/components/icon';

export const metadata = { title: 'Смартлинк' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditSmartLinkPage({ params }: Props) {
  const { id } = await params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/dashboard/links', locale });

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) return redirect({ href: '/dashboard', locale });

  const smartLink = await getSmartLinkById(id);
  if (!smartLink || smartLink.artistProfileId !== artist.id) notFound();

  const releaseOptions = await getReleaseOptions(artist.id);

  const initial: SmartLinkInitial = {
    id: smartLink.id,
    slug: smartLink.slug,
    title: smartLink.title,
    subtitle: smartLink.subtitle,
    coverUrl: smartLink.coverUrl,
    releaseDate: smartLink.releaseDate ? smartLink.releaseDate.toISOString() : null,
    releaseId: smartLink.releaseId,
    links: smartLink.links,
    isPublished: smartLink.isPublished,
  };

  return (
    <div className="flex flex-col gap-8">
      <DashboardPageHeader
        backHref="/dashboard/links"
        backLabel="Смартлинки"
        title="Редактирование"
        subtitle={
          smartLink.isPublished ? (
            <a
              href={`/smartlink/${artist.slug}/${smartLink.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground/70 transition-colors font-mono"
            >
              /smartlink/{artist.slug}/{smartLink.slug} <Icon name="external-link" size={12} />
            </a>
          ) : undefined
        }
      />

      <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-6">
        <SmartLinkForm artistSlug={artist.slug} initial={initial} releaseOptions={releaseOptions} />
      </div>
    </div>
  );
}
