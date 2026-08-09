'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

export function UnblockButton({ targetUserId }: { targetUserId: string }) {
  const t = useTranslations('social.unblock');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function unblock() {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/users/${targetUserId}/block`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setPending(false);
      toast.error(t('failed'));
    }
  }

  return (
    <button
      type="button"
      onClick={unblock}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-4 min-h-11 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary disabled:opacity-50"
    >
      <Icon name="unlock" size={15} />
      {t('button')}
    </button>
  );
}
