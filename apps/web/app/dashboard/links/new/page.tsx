import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { getReleaseOptions } from '@vire/db';
import { SmartLinkForm } from '../smart-link-form';
import { DashboardPageHeader } from '@/components/ui-kit';

export const metadata = { title: 'Новый смартлинк' };
export const dynamic = 'force-dynamic';

export default async function NewSmartLinkPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/links/new');

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) redirect('/dashboard');

  const releaseOptions = await getReleaseOptions(artist.id);

  return (
    <div className="flex flex-col gap-8">
      <DashboardPageHeader backHref="/dashboard/links" backLabel="Смартлинки" title="Новый лендинг" />

      <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-6">
        <SmartLinkForm artistSlug={artist.slug} releaseOptions={releaseOptions} />
      </div>
    </div>
  );
}
