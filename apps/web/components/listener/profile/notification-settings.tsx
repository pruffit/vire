'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';
import { getPushState, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';
import { SettingToggle } from './setting-toggle';

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

function EmailToggle({ initial }: { initial: boolean }) {
  const t = useTranslations('profile.notificationSettings');
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const prev = on;
    const next = !on;
    setOn(next);
    setPending(true);
    try {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEmail: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setOn(prev);
      toast.error(t('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingToggle
      title={t('emailTitle')}
      description={on ? t('emailOnDescription') : t('emailOffDescription')}
      checked={on}
      disabled={pending}
      onToggle={toggle}
    />
  );
}

function PushToggle() {
  const t = useTranslations('profile.notificationSettings');
  const [state, setState] = useState<PushState>('loading');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  if (state === 'loading') {
    return (
      <SettingToggle title={t('pushTitle')} description={t('pushCheckingSupport')} checked={false} disabled onToggle={() => {}} />
    );
  }
  if (state === 'unsupported') {
    return (
      <SettingToggle title={t('pushTitle')} description={t('pushUnsupported')} checked={false} disabled onToggle={() => {}} />
    );
  }
  if (state === 'denied') {
    return (
      <SettingToggle title={t('pushTitle')} description={t('pushDenied')} checked={false} disabled onToggle={() => {}} />
    );
  }

  const subscribed = state === 'subscribed';

  async function patchNotifyPush(notifyPush: boolean) {
    try {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyPush }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      toast.error(t('saveFailed'));
    }
  }

  async function toggle() {
    setPending(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setState('unsubscribed');
        await patchNotifyPush(false);
      } else {
        const result = await subscribeToPush();
        if (result.ok) {
          setState('subscribed');
          await patchNotifyPush(true);
        } else if (result.reason === 'permission') {
          toast.error(t('pushPermissionDenied'));
          if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setState('denied');
        } else if (result.reason === 'sw' || result.reason === 'push-service') {
          toast.error(t('pushServiceUnavailable'));
        } else {
          toast.error(t('pushRejected'));
        }
      }
    } catch {
      toast.error(t('pushToggleFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingToggle
      title={t('pushTitle')}
      description={subscribed ? t('pushOnDescription') : t('pushOffDescription')}
      checked={subscribed}
      disabled={pending}
      onToggle={toggle}
    />
  );
}

export function NotificationSettings({ initialNotifyEmail }: { initialNotifyEmail: boolean }) {
  return (
    <div className="space-y-3">
      <EmailToggle initial={initialNotifyEmail} />
      <PushToggle />
    </div>
  );
}
