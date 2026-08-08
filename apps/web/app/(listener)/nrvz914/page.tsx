import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { PARTY_PATH } from '@/lib/party';
import { CreateJamButton } from '../jam/create-jam-button';
import { JamCodeForm } from '../jam/jam-code-form';

export const metadata: Metadata = { title: 'Вечеринка', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PartyLandingPage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-10 text-center">
        <div className="space-y-2">
          <p className="label-wide text-muted-foreground">Вечеринка</p>
          <h1 className="text-2xl font-semibold tracking-tight">Любой трек, любая колонка</h1>
          <p className="text-sm text-muted-foreground">
            Общая очередь для тусовки — гости кидают что угодно, хоть ссылку с любого сервиса.
          </p>
        </div>

        {isLoggedIn ? (
          <CreateJamButton kind="PARTY" basePath={PARTY_PATH} />
        ) : (
          <div className="rounded-xl border border-border bg-card/50 p-4 text-sm">
            <p className="text-muted-foreground">Войдите, чтобы начать вечеринку</p>
            <Link href={`/sign-in?callbackUrl=${PARTY_PATH}`} className="mt-2 inline-block font-medium text-foreground hover:underline">
              Войти →
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">или</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <JamCodeForm basePath={PARTY_PATH} />
      </div>
    </div>
  );
}
