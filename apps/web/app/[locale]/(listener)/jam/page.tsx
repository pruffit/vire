import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/auth';
import { CreateJamButton } from './create-jam-button';
import { JamCodeForm } from './jam-code-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jam.landing');
  return { title: t('title') };
}
export const dynamic = 'force-dynamic';

export default async function JamLandingPage() {
  const [session, t] = await Promise.all([auth(), getTranslations('jam.landing')]);
  const isLoggedIn = Boolean(session?.user?.id);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-10 text-center">
        <div className="space-y-2">
          <p className="label-wide text-muted-foreground">{t('eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {isLoggedIn ? (
          <CreateJamButton />
        ) : (
          <div className="rounded-xl border border-border bg-card/50 p-4 text-sm">
            <p className="text-muted-foreground">{t('signInPrompt')}</p>
            <Link href="/sign-in?callbackUrl=/jam" className="mt-2 inline-block font-medium text-foreground hover:underline">
              {t('signInLink')}
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t('or')}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <JamCodeForm />
      </div>
    </div>
  );
}
