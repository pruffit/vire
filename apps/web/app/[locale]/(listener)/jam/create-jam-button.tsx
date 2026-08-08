'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { JamMode, JamSessionKind } from '@vire/core';
import { Button } from '@vire/ui';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';
import { touchPill } from '@/components/popover';
import { cn } from '@/lib/utils';
import { JAM_MODE_OPTIONS } from '@/lib/jam/jam-mode-labels';

interface Props {
  /** Вечеринка — отдельный вход/комната (`PARTY_PATH`), обычный джем — `/jam`. */
  kind?: JamSessionKind;
  basePath?: string;
}

export function CreateJamButton({ kind = 'JAM', basePath = '/jam' }: Props) {
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<JamMode>('SYNCED');
  const router = useRouter();

  async function handleCreate() {
    setPending(true);
    try {
      const res = await fetch('/api/v1/jam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'PARTY' ? { mode, kind } : { mode }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { code: string };
      router.push(`${basePath}/${data.code}`);
    } catch {
      toast.error('Не удалось создать джем');
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Режим воспроизведения" className="flex justify-center gap-2">
        {JAM_MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            onClick={() => setMode(option.value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              touchPill,
              mode === option.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Button
        size="lg"
        disabled={pending}
        onClick={() => void handleCreate()}
        className="h-14 w-full rounded-full text-base font-semibold gap-2"
      >
        {pending && <Icon name="loader" size={16} className="animate-spin" />}
        Создать джем
      </Button>
    </div>
  );
}
