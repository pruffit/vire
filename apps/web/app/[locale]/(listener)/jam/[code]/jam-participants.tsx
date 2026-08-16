'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { JamParticipant } from '@vire/core';
import { Icon } from '@/components/icon';
import { AdaptivePopover } from '@/components/adaptive-popover';

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

function ParticipantRow({ participant }: { participant: JamParticipant }) {
  const t = useTranslations('jam.participantsPopover');
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
        {initial(participant.displayName)}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm text-foreground/85">{participant.displayName}</span>
      {participant.role === 'HOST' && (
        <span className="shrink-0 label-mono text-[10px] text-muted-foreground">{t('host')}</span>
      )}
    </div>
  );
}

interface Props {
  participants: JamParticipant[];
  /** 'inline' — постоянный блок в правой панели (десктоп), без попап-триггера. */
  variant?: 'popover' | 'inline';
}

export function JamParticipants({ participants, variant = 'popover' }: Props) {
  const t = useTranslations('jam.participantsPopover');
  const [open, setOpen] = useState(false);

  if (variant === 'inline') {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-2">
        <p className="flex items-center gap-1.5 px-2 pt-1 pb-2 label-mono text-muted-foreground">
          <Icon name="users" size={12} /> {t('title')} <span className="tabular-nums">· {participants.length}</span>
        </p>
        <div className="max-h-64 overflow-y-auto overflow-x-clip">
          {participants.map((p) => (
            <ParticipantRow key={p.id} participant={p} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AdaptivePopover
      open={open}
      onOpenChange={setOpen}
      align="left"
      drop="down"
      title={t('title')}
      panelClassName="w-56"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label={t('aria')}
          aria-expanded={open}
          className="min-h-11 inline-flex items-center gap-1.5 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="users" size={14} />
          <span className="tabular-nums">{participants.length}</span>
        </button>
      )}
    >
      <div className="max-h-72 overflow-y-auto overflow-x-clip py-1">
        {participants.map((p) => (
          <ParticipantRow key={p.id} participant={p} />
        ))}
      </div>
    </AdaptivePopover>
  );
}
