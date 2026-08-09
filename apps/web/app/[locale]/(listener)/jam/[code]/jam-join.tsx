'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@vire/ui';
import { Icon } from '@/components/icon';
import { generateGuestName } from '@/lib/jam/guest-name';

interface Props {
  title: string | null;
  hostDisplayName: string;
  ended: boolean;
  isLoggedIn: boolean;
  pending: boolean;
  onJoin: (displayName: string) => void;
  kind?: 'JAM' | 'PARTY';
}

export function JamJoin({ title, hostDisplayName, ended, isLoggedIn, pending, onJoin, kind = 'JAM' }: Props) {
  const t = useTranslations('jam.join');
  const tRoot = useTranslations('jam');
  const [name, setName] = useState(() => generateGuestName(Math.random, tRoot.raw('guestNameAdjectives'), tRoot.raw('guestNameNouns')));
  const eyebrow = t(`eyebrow.${kind}`);

  if (ended) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-2xl font-semibold tracking-tight">{t(`endedTitle.${kind}`)}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t('endedHint')}</p>
      </div>
    );
  }

  const canSubmit = isLoggedIn || name.trim().length > 0;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <p className="label-wide text-muted-foreground">{eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title ?? t(`defaultTitle.${kind}`)}</h1>
          <p className="text-sm text-muted-foreground">{t('hostedBy', { name: hostDisplayName })}</p>
        </div>

        {!isLoggedIn && (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={t('namePlaceholder')}
            aria-label={t('nameAria')}
            className="h-11 text-center text-base"
          />
        )}

        <Button
          size="lg"
          disabled={pending || !canSubmit}
          onClick={() => onJoin(isLoggedIn ? '' : name.trim())}
          className="h-14 w-full rounded-full text-base font-semibold gap-2"
        >
          {pending && <Icon name="loader" size={16} className="animate-spin" />}
          {t('submit')}
        </Button>

        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('gestureHint')}
        </p>
      </div>
    </div>
  );
}
