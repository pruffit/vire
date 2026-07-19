'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { SettingToggle } from './setting-toggle';

type Visibility = 'FRIENDS' | 'PRIVATE';

export function PrivacySettings({ initial }: { initial: Visibility }) {
  const [visibility, setVisibility] = useState<Visibility>(initial);
  const [pending, setPending] = useState(false);
  const isFriends = visibility === 'FRIENDS';

  async function toggle() {
    const prev = visibility;
    const next: Visibility = isFriends ? 'PRIVATE' : 'FRIENDS';
    setVisibility(next);
    setPending(true);
    try {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialVisibility: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setVisibility(prev);
      toast.error('Не удалось сохранить настройку приватности');
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingToggle
      title="Лайки видны друзьям"
      description={isFriends ? 'Друзья видят твои лайки.' : 'Лайки скрыты от всех.'}
      checked={isFriends}
      disabled={pending}
      onToggle={toggle}
    />
  );
}
