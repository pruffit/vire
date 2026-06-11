import { getUserAuthInfo } from '@vire/db';
import { LinkedAccountsClient } from './linked-accounts-client';

export async function LinkedAccounts({ userId }: { userId: string }) {
  const info = await getUserAuthInfo(userId);
  const hasYandex = info.providers.some((p) => p.provider === 'yandex');

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Способы входа</h2>
      <LinkedAccountsClient hasPassword={info.hasPassword} hasYandex={hasYandex} />
    </section>
  );
}
