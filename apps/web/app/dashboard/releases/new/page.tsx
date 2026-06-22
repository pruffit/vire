import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { CreateReleaseForm } from './create-release-form';
import { btnGhost } from '@/components/ui-kit';

export const metadata = { title: 'Новый релиз' };

export default async function NewReleasePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/releases/new');

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) redirect('/dashboard');

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-8">

        <div className="flex flex-col gap-1">
          <a href="/dashboard" className={`${btnGhost} self-start mb-2`}>← Дашборд</a>
          <h1 className="text-2xl font-semibold">Новый релиз</h1>
          <p className="text-sm text-foreground/40">{artist.name}</p>
        </div>

        <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 sm:p-6">
          <CreateReleaseForm artistName={artist.name} />
        </div>

      </div>
    </div>
  );
}
