import { getUserAuthInfo } from '@vire/db';
import { LinkedAccountsClient } from './linked-accounts-client';

interface Props {
  userId: string;
  linkError?: string;
}

export async function LinkedAccounts({ userId, linkError }: Props) {
  const info = await getUserAuthInfo(userId);
  const linkedProviders = info.providers.map((p) => p.provider);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Способы входа</h2>
      <LinkedAccountsClient
        hasPassword={info.hasPassword}
        linkedProviders={linkedProviders}
        linkError={linkError}
      />
    </section>
  );
}
