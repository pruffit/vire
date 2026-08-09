'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { normalizeJamCode } from '@vire/core';
import { Button, Input } from '@vire/ui';

interface Props {
  basePath?: string;
}

export function JamCodeForm({ basePath = '/jam' }: Props) {
  const t = useTranslations('jam.codeForm');
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
        placeholder={t('placeholder')}
        aria-label={t('aria')}
        className="h-11 text-center font-mono text-lg tracking-[0.3em]"
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!normalized}
        className="h-11 w-full rounded-full text-sm font-medium"
      >
        {t('submit')}
      </Button>
    </form>
  );
}
