'use client';
import { useState } from 'react';
import type { JamParticipant } from '@vire/core';
import { Icon } from '@/components/icon';
import { Popover } from '@/components/popover';

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

function ParticipantRow({ participant }: { participant: JamParticipant }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
        {initial(participant.displayName)}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm text-foreground/85">{participant.displayName}</span>
      {participant.role === 'HOST' && (
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Хост</span>
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
  const [open, setOpen] = useState(false);

  if (variant === 'inline') {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-2">
        <p className="flex items-center gap-1.5 px-2 pt-1 pb-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          <Icon name="users" size={12} /> Участники <span className="tabular-nums">· {participants.length}</span>
        </p>
        <div className="max-h-64 overflow-y-auto">
          {participants.map((p) => (
            <ParticipantRow key={p.id} participant={p} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="left"
      drop="down"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label="Участники джема"
          aria-expanded={open}
          className="min-h-11 inline-flex items-center gap-1.5 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="users" size={14} />
          <span className="tabular-nums">{participants.length}</span>
        </button>
      )}
    >
      <div className="max-h-72 w-56 overflow-y-auto py-1">
        {participants.map((p) => (
          <ParticipantRow key={p.id} participant={p} />
        ))}
      </div>
    </Popover>
  );
}
