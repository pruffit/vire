'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionSetFeatureFlag } from '../actions';
import { Tr, Td, Badge, Switch } from '@/components/admin/ui';
import { toast } from '@/lib/toast';

interface Flag {
  key: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
  overridden: boolean;
  updatedAt: string | null;
}

export function FlagRow({ flag, canMutate }: { flag: Flag; canMutate: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(flag.enabled);

  function toggle(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    start(async () => {
      const res = await actionSetFeatureFlag(flag.key, next);
      if (res?.error) {
        setEnabled(previous);
        toast.error(res.error);
        return;
      }
      toast(next ? 'Флаг включён' : 'Флаг выключен');
      router.refresh();
    });
  }

  return (
    <Tr>
      <Td className="w-full">
        <div className="flex flex-col gap-0.5 px-2 py-1">
          <span className="font-mono text-xs text-foreground/80">{flag.key}</span>
          <span className="text-xs text-foreground/50">{flag.description}</span>
        </div>
      </Td>
      <Td label="Источник">
        <Badge tone={flag.overridden ? 'info' : 'neutral'}>
          {flag.overridden ? 'база' : `умолчание: ${flag.defaultEnabled ? 'вкл' : 'выкл'}`}
        </Badge>
      </Td>
      <Td label="Изменён" mono tone="faint" nowrap>
        {flag.updatedAt ? new Date(flag.updatedAt).toLocaleString('ru-RU') : '—'}
      </Td>
      <Td label="Состояние" align="right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-foreground/50">{enabled ? 'вкл' : 'выкл'}</span>
          {canMutate ? (
            <Switch checked={enabled} onChange={toggle} disabled={pending} aria-label={`Флаг ${flag.key}`} />
          ) : (
            <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'вкл' : 'выкл'}</Badge>
          )}
        </div>
      </Td>
    </Tr>
  );
}
