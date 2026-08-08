'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { normalizeJamCode } from '@vire/core';
import { Button, Input } from '@vire/ui';

interface Props {
  basePath?: string;
}

export function JamCodeForm({ basePath = '/jam' }: Props) {
  const [value, setValue] = useState('');
  const router = useRouter();
  const normalized = normalizeJamCode(value);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!normalized) return;
    router.push(`${basePath}/${normalized}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase().slice(0, 6))}
        maxLength={6}
        placeholder="Код джема"
        aria-label="Код джема"
        className="h-11 text-center font-mono text-lg tracking-[0.3em]"
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!normalized}
        className="h-11 w-full rounded-full text-sm font-medium"
      >
        Войти по коду
      </Button>
    </form>
  );
}
