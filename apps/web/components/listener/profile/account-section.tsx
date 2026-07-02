import { LinkedAccounts } from '@/app/(listener)/profile/linked-accounts';
import { Section } from '@/components/listener/section';
import { AppearanceSettings } from './appearance-settings';
import { SignOutButton } from './sign-out-button';

interface Props {
  userId: string;
  linkError?: string;
}

export function AccountSection({ userId, linkError }: Props) {
  return (
    <section className="animate-fade-up max-w-2xl space-y-8">
      <LinkedAccounts userId={userId} linkError={linkError} />
      <Section title="Оформление">
        <AppearanceSettings />
      </Section>
      <div className="pt-2 border-t border-border">
        <SignOutButton />
      </div>
    </section>
  );
}
