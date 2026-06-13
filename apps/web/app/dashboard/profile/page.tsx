import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { EditProfileForm, type EditableProfile } from './edit-profile-form';

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
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <a href="/dashboard" className="text-xs text-white/30 hover:text-white/60 transition-colors mb-2 self-start">
            ← дашборд
          </a>
          <h1 className="text-2xl font-semibold">Профиль артиста</h1>
          <p className="text-sm text-white/40">@{artist.slug}</p>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <EditProfileForm artist={profile} />
        </div>
      </div>
    </div>
  );
}
