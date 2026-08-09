import { getTranslations } from 'next-intl/server';
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

export async function AccountSection({ userId, linkError, socialVisibility, discoverable, notifyEmail, lastfmUsername }: Props) {
  const t = await getTranslations('profile.accountSection');
  return (
    <section className="animate-fade-up grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
      <LinkedAccounts userId={userId} linkError={linkError} />
      <div className="space-y-8">
        <Section title={t('appearance')}>
          <AppearanceSettings />
        </Section>
        <Section title={t('notifications')}>
          <NotificationSettings initialNotifyEmail={notifyEmail} />
        </Section>
        <Section title={t('privacy')}>
          <div className="space-y-3">
            <PrivacySettings initial={socialVisibility} />
            <DiscoverabilitySettings initial={discoverable} />
          </div>
        </Section>
        <Section title={t('musicTaste')}>
          <LastfmSettings initial={lastfmUsername} />
        </Section>
        <div className="pt-2 border-t border-border">
          <SignOutButton />
        </div>
      </div>
    </section>
  );
}
