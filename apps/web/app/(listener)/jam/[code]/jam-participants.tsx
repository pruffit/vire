'use client';
import { useState } from 'react';
import type { JamParticipant } from '@vire/core';
import { Icon } from '@/components/icon';
import { Popover, touchTargetClass } from '@/components/popover';

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export function JamParticipants({ participants }: { participants: JamParticipant[] }) {
  const [open, setOpen] = useState(false);

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
          className={`${touchTargetClass('md')} inline-flex items-center gap-1.5 rounded-full border border-border px-3 text-sm text-muted-foreground hover:text-foreground transition-colors`}
        >
          <Icon name="users" size={14} />
          <span className="tabular-nums">{participants.length}</span>
        </button>
      )}
    >
      <div className="max-h-72 w-56 overflow-y-auto py-1">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
              {initial(p.displayName)}
            </span>
            <span className="flex-1 min-w-0 truncate text-sm text-foreground/85">{p.displayName}</span>
            {p.role === 'HOST' && (
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Хост</span>
            )}
          </div>
        ))}
      </div>
    </Popover>
  );
}
