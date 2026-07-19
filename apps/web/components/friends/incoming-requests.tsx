'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { IncomingRequest } from '@vire/core';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

const PRIMARY =
  'inline-flex items-center gap-1.5 rounded-full px-4 min-h-11 text-sm font-medium bg-primary text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none';
const MUTED =
  'inline-flex items-center gap-1.5 rounded-full px-4 min-h-11 text-sm font-medium bg-secondary/60 text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none';

export function IncomingRequests({ initial }: { initial: IncomingRequest[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());

  if (rows.length === 0) return null;

  async function resolve(row: IncomingRequest, index: number, run: () => Promise<Response>, errorText: string) {
    setRows((r) => r.filter((x) => x.id !== row.id));
    setPending((p) => new Set(p).add(row.id));
    try {
      const res = await run();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setRows((r) => {
        const next = [...r];
        next.splice(index, 0, row);
        return next;
      });
      toast.error(errorText);
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(row.id);
        return n;
      });
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Входящие заявки</h2>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-md border border-border/40 bg-card p-3"
          >
            {row.image ? (
              <Image src={row.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                {(row.name ?? '?')[0]?.toUpperCase()}
              </div>
            )}
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{row.name ?? 'Слушатель'}</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={pending.has(row.id)}
                onClick={() =>
                  resolve(
                    row,
                    i,
                    () => fetch(`/api/v1/friends/${row.id}/accept`, { method: 'POST' }),
                    'Не удалось принять заявку',
                  )
                }
                className={PRIMARY}
              >
                <Icon name="check" size={15} />
                Принять
              </button>
              <button
                type="button"
                disabled={pending.has(row.id)}
                onClick={() =>
                  resolve(row, i, () => fetch(`/api/v1/friends/${row.id}`, { method: 'DELETE' }), 'Не удалось отклонить заявку')
                }
                className={MUTED}
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
