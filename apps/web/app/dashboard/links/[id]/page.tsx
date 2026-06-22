import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { getSmartLinkById, getReleaseOptions } from '@vire/db';
import { SmartLinkForm, type SmartLinkInitial } from '../smart-link-form';
import { btnGhost } from '@/components/ui-kit';

export const metadata = { title: 'Смартлинк' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditSmartLinkPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/links');

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) redirect('/dashboard');

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
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard/links" className={`${btnGhost} self-start mb-2`}>← Смартлинки</Link>
          <h1 className="text-2xl font-semibold">Редактирование</h1>
          {smartLink.isPublished && (
            <a
              href={`/smartlink/${artist.slug}/${smartLink.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors self-start font-mono"
            >
              /smartlink/{artist.slug}/{smartLink.slug} ↗
            </a>
          )}
        </div>

        <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-6">
          <SmartLinkForm artistSlug={artist.slug} initial={initial} releaseOptions={releaseOptions} />
        </div>
      </div>
    </div>
  );
}
