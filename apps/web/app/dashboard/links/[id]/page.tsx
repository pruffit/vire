import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { getSmartLinkById } from '@vire/db';
import { SmartLinkForm, type SmartLinkInitial } from '../smart-link-form';

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

  const initial: SmartLinkInitial = {
    id: smartLink.id,
    slug: smartLink.slug,
    title: smartLink.title,
    subtitle: smartLink.subtitle,
    coverUrl: smartLink.coverUrl,
    releaseDate: smartLink.releaseDate ? smartLink.releaseDate.toISOString() : null,
    links: smartLink.links,
    isPublished: smartLink.isPublished,
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard/links" className="text-xs text-white/30 hover:text-white/60 transition-colors mb-2 self-start">
            ← смартлинки
          </Link>
          <h1 className="text-2xl font-semibold">Редактирование</h1>
          {smartLink.isPublished && (
            <a
              href={`/smartlink/${artist.slug}/${smartLink.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/70 transition-colors self-start font-mono"
            >
              /smartlink/{artist.slug}/{smartLink.slug} ↗
            </a>
          )}
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <SmartLinkForm artistSlug={artist.slug} initial={initial} />
        </div>
      </div>
    </div>
  );
}
