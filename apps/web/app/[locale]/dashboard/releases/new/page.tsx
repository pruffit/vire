import type { Metadata } from 'next';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { CreateReleaseForm } from './create-release-form';
import { DashboardPageHeader } from '@/components/ui-kit';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.releases');
  return { title: t('newMetaTitle') };
}

export default async function NewReleasePage() {
  const [session, locale, t, tCommon] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('dashboard.releases'),
    getTranslations('dashboard.common'),
  ]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/dashboard/releases/new', locale });

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) return redirect({ href: '/dashboard', locale });

  return (
    <div className="flex flex-col gap-8">
      <DashboardPageHeader backHref="/dashboard" backLabel={tCommon('dashboardLabel')} title={t('newMetaTitle')} subtitle={artist.name} />

      <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-6">
        <CreateReleaseForm artistName={artist.name} />
      </div>
    </div>
  );
}
