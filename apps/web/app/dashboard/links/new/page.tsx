import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { getReleaseOptions } from '@vire/db';
import { SmartLinkForm } from '../smart-link-form';

export const metadata = { title: 'Новый смартлинк' };
export const dynamic = 'force-dynamic';

export default async function NewSmartLinkPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/links/new');

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) redirect('/dashboard');

  const releaseOptions = await getReleaseOptions(artist.id);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard/links" className="text-xs text-white/30 hover:text-white/60 transition-colors mb-2 self-start">
            ← смартлинки
          </Link>
          <h1 className="text-2xl font-semibold">Новый лендинг</h1>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <SmartLinkForm artistSlug={artist.slug} releaseOptions={releaseOptions} />
        </div>
      </div>
    </div>
  );
}
