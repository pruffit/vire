'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { SettingToggle } from './setting-toggle';

export function DiscoverabilitySettings({ initial }: { initial: boolean }) {
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
        body: JSON.stringify({ discoverable: next }),
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
      title="Показывать меня в поиске"
      description={on ? 'Другие могут найти тебя по имени.' : 'Ты скрыт из поиска людей.'}
      checked={on}
      disabled={pending}
      onToggle={toggle}
    />
  );
}
