import { getTranslations } from 'next-intl/server';
import { getUserAuthInfo } from '@vire/db';
import { LinkedAccountsClient } from './linked-accounts-client';

interface Props {
  userId: string;
  linkError?: string;
}

export async function LinkedAccounts({ userId, linkError }: Props) {
  const [info, t] = await Promise.all([getUserAuthInfo(userId), getTranslations('profile.linkedAccounts')]);
  const linkedProviders = info.providers.map((p) => p.provider);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('title')}</h2>
      <LinkedAccountsClient
        hasPassword={info.hasPassword}
        linkedProviders={linkedProviders}
        linkError={linkError}
      />
    </section>
  );
}
