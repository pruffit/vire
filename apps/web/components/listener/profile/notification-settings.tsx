'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { getPushState, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';
import { SettingToggle } from './setting-toggle';

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

function EmailToggle({ initial }: { initial: boolean }) {
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
      toast.error('Не удалось сохранить настройку');
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingToggle
      title="Уведомления на почту"
      description={on ? 'Письма о важных событиях приходят на почту.' : 'Письма на почту отключены.'}
      checked={on}
      disabled={pending}
      onToggle={toggle}
    />
  );
}

function PushToggle() {
  const [state, setState] = useState<PushState>('loading');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  if (state === 'loading') {
    return (
      <SettingToggle title="Push-уведомления" description="Проверяем поддержку браузером…" checked={false} disabled onToggle={() => {}} />
    );
  }
  if (state === 'unsupported') {
    return (
      <SettingToggle title="Push-уведомления" description="Пуши не поддерживаются этим браузером." checked={false} disabled onToggle={() => {}} />
    );
  }
  if (state === 'denied') {
    return (
      <SettingToggle title="Push-уведомления" description="Разблокируй уведомления в настройках браузера." checked={false} disabled onToggle={() => {}} />
    );
  }

  const subscribed = state === 'subscribed';

  async function toggle() {
    setPending(true);
    if (subscribed) {
      await unsubscribeFromPush();
      setState('unsubscribed');
    } else {
      const ok = await subscribeToPush();
      if (ok) {
        setState('subscribed');
      } else {
        toast.error('Не удалось включить push-уведомления');
      }
    }
    setPending(false);
  }

  return (
    <SettingToggle
      title="Push-уведомления"
      description={subscribed ? 'Уведомления приходят в браузер.' : 'Включи, чтобы получать уведомления в браузер.'}
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
