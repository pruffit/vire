import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { CreateJamButton } from './create-jam-button';
import { JamCodeForm } from './jam-code-form';

export const metadata: Metadata = { title: 'Джем' };
export const dynamic = 'force-dynamic';

export default async function JamLandingPage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-10 text-center">
        <div className="space-y-2">
          <p className="label-wide text-muted-foreground">Джем</p>
          <h1 className="text-2xl font-semibold tracking-tight">Слушайте музыку вместе</h1>
          <p className="text-sm text-muted-foreground">
            Общая очередь и синхронное воспроизведение для компании в одной комнате.
          </p>
        </div>

        {isLoggedIn ? (
          <CreateJamButton />
        ) : (
          <div className="rounded-xl border border-border bg-card/50 p-4 text-sm">
            <p className="text-muted-foreground">Войдите, чтобы создать джем</p>
            <Link href="/sign-in?callbackUrl=/jam" className="mt-2 inline-block font-medium text-foreground hover:underline">
              Войти →
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">или</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <JamCodeForm />
      </div>
    </div>
  );
}
