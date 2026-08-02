import { LinkedAccounts } from './linked-accounts';
import { Section } from '@/components/listener/section';
import { AppearanceSettings } from './appearance-settings';
import { PrivacySettings } from './privacy-settings';
import { DiscoverabilitySettings } from './discoverability-settings';
import { NotificationSettings } from './notification-settings';
import { LastfmSettings } from './lastfm-settings';
import { SignOutButton } from './sign-out-button';

interface Props {
  userId: string;
  linkError?: string;
  socialVisibility: 'FRIENDS' | 'PRIVATE';
  discoverable: boolean;
  notifyEmail: boolean;
  lastfmUsername: string | null;
}

export function AccountSection({ userId, linkError, socialVisibility, discoverable, notifyEmail, lastfmUsername }: Props) {
  return (
    <section className="animate-fade-up grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
      <LinkedAccounts userId={userId} linkError={linkError} />
      <div className="space-y-8">
        <Section title="Оформление">
          <AppearanceSettings />
        </Section>
        <Section title="Уведомления">
          <NotificationSettings initialNotifyEmail={notifyEmail} />
        </Section>
        <Section title="Приватность">
          <div className="space-y-3">
            <PrivacySettings initial={socialVisibility} />
            <DiscoverabilitySettings initial={discoverable} />
          </div>
        </Section>
        <Section title="Музыкальный вкус">
          <LastfmSettings initial={lastfmUsername} />
        </Section>
        <div className="pt-2 border-t border-border">
          <SignOutButton />
        </div>
      </div>
    </section>
  );
}
