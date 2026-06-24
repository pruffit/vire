import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { EditProfileForm, type EditableProfile } from './edit-profile-form';
import { DashboardPageHeader } from '@/components/ui-kit';
import { Icon } from '@/components/icon';

export const metadata = { title: 'Профиль артиста' };
export const dynamic = 'force-dynamic';

export default async function DashboardProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/profile');

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) redirect('/dashboard');

  // Strip Date fields (createdAt/updatedAt) before passing to the client form
  const profile: EditableProfile = {
    name: artist.name,
    bio: artist.bio,
    avatarUrl: artist.avatarUrl,
    themeTokens: artist.themeTokens,
    links: artist.links,
    videos: artist.videos,
  };

  return (
    <div className="flex flex-col gap-8">
      <DashboardPageHeader
        backHref="/dashboard"
        title="Профиль артиста"
        subtitle={`@${artist.slug}`}
        action={
          <a
            href={`/artists/${artist.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
          >
            Открыть <Icon name="external-link" size={14} />
          </a>
        }
      />

      <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-6">
        <EditProfileForm artist={profile} />
      </div>
    </div>
  );
}
