'use client';
import { useState } from 'react';
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
  const [name, setName] = useState(() => generateGuestName());
  const eyebrow = kind === 'PARTY' ? 'Вечеринка' : 'Джем';

  if (ended) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-2xl font-semibold tracking-tight">{kind === 'PARTY' ? 'Вечеринка завершена' : 'Джем завершён'}</p>
        <p className="mt-3 text-sm text-muted-foreground">Хост закрыл эту сессию — ссылка больше не активна.</p>
      </div>
    );
  }

  const canSubmit = isLoggedIn || name.trim().length > 0;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <p className="label-wide text-muted-foreground">{eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title ?? (kind === 'PARTY' ? 'Вечеринка' : 'Джем-сессия')}</h1>
          <p className="text-sm text-muted-foreground">Хост — {hostDisplayName}</p>
        </div>

        {!isLoggedIn && (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Ваше имя"
            aria-label="Ваше имя"
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
          Подключиться к звуку
        </Button>

        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          Браузер требует явное подтверждение перед тем, как включить звук — так устроены все платформы.
        </p>
      </div>
    </div>
  );
}
