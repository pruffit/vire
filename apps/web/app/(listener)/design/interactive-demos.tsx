'use client';

import { useState } from 'react';
import { Check, Switch, Panel } from '@/components/ui-kit';

export function InteractiveDemos() {
  const [sw1, setSw1] = useState(false);
  const [sw2, setSw2] = useState(true);
  const [ch1, setCh1] = useState(false);
  const [ch2, setCh2] = useState(true);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Panel className="p-5 space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/40">Switch</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground/85">Уведомления</span>
            <Switch checked={sw1} onChange={setSw1} aria-label="Уведомления" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground/85">Автовоспроизведение</span>
            <Switch checked={sw2} onChange={setSw2} aria-label="Автовоспроизведение" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground/45">Отключено</span>
            <Switch checked={false} onChange={() => {}} disabled aria-label="Отключённый переключатель" />
          </div>
        </div>
      </Panel>

      <Panel className="p-5 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/40">Check</p>
        <Check
          label="Explicit (ненормативная лексика)"
          hint="Отметьте, если трек содержит мат"
          checked={ch1}
          onChange={setCh1}
        />
        <Check
          label="Публично (виден всем)"
          checked={ch2}
          onChange={setCh2}
        />
        <Check
          label="Заблокировано"
          checked={false}
          onChange={() => {}}
          disabled
        />
      </Panel>
    </div>
  );
}
