'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { IncomingRequest } from '@vire/core';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

const PRIMARY =
  'inline-flex items-center gap-1.5 rounded-full px-4 min-h-11 text-sm font-medium bg-primary text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none';
const MUTED =
  'inline-flex items-center gap-1.5 rounded-full px-4 min-h-11 text-sm font-medium bg-secondary/60 text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none';

export function IncomingRequests({ initial }: { initial: IncomingRequest[] }) {
  const t = useTranslations('social.incomingRequests');
  const tc = useTranslations('common');
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
      <h2 className="text-lg font-semibold tracking-tight">{t('heading')}</h2>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border/40 bg-card p-3"
          >
            <div className="flex min-w-0 flex-1 basis-[12rem] items-center gap-3">
              {row.image ? (
                <Image src={row.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                  {(row.name ?? '?')[0]?.toUpperCase()}
                </div>
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{row.name ?? tc('listenerFallback')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={pending.has(row.id)}
                onClick={() =>
                  resolve(
                    row,
                    i,
                    () => fetch(`/api/v1/friends/${row.id}/accept`, { method: 'POST' }),
                    t('errors.accept'),
                  )
                }
                className={PRIMARY}
              >
                <Icon name="check" size={15} />
                {t('accept')}
              </button>
              <button
                type="button"
                disabled={pending.has(row.id)}
                onClick={() =>
                  resolve(row, i, () => fetch(`/api/v1/friends/${row.id}`, { method: 'DELETE' }), t('errors.decline'))
                }
                className={MUTED}
              >
                {t('decline')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
