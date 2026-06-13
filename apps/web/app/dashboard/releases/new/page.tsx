import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository } from '@vire/db';
import { CreateReleaseForm } from './create-release-form';

export const metadata = { title: 'Новый релиз' };

export default async function NewReleasePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/releases/new');

  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) redirect('/dashboard');

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-8">

        <div className="flex flex-col gap-1">
          <a href="/dashboard" className="text-xs text-white/30 hover:text-white/60 transition-colors mb-2 self-start">
            ← дашборд
          </a>
          <h1 className="text-2xl font-semibold">Новый релиз</h1>
          <p className="text-sm text-white/40">{artist.name}</p>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-4 sm:p-6">
          <CreateReleaseForm />
        </div>

      </div>
    </div>
  );
}
