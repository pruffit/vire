import { LinkedAccounts } from './linked-accounts';
import { Section } from '@/components/listener/section';
import { AppearanceSettings } from './appearance-settings';
import { SignOutButton } from './sign-out-button';

interface Props {
  userId: string;
  linkError?: string;
}

export function AccountSection({ userId, linkError }: Props) {
  return (
    <section className="animate-fade-up grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
      <LinkedAccounts userId={userId} linkError={linkError} />
      <div className="space-y-8">
        <Section title="Оформление">
          <AppearanceSettings />
        </Section>
        <div className="pt-2 border-t border-border">
          <SignOutButton />
        </div>
      </div>
    </section>
  );
}
