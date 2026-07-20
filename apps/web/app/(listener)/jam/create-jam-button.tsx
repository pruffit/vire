'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vire/ui';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

export function CreateJamButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    setPending(true);
    try {
      const res = await fetch('/api/v1/jam', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { code: string };
      router.push(`/jam/${data.code}`);
    } catch {
      toast.error('Не удалось создать джем');
      setPending(false);
    }
  }

  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() => void handleCreate()}
      className="h-14 w-full rounded-full text-base font-semibold gap-2"
    >
      {pending && <Icon name="loader" size={16} className="animate-spin" />}
      Создать джем
    </Button>
  );
}
