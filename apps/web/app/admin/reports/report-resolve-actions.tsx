'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReportResolveActions({ reportId, canMutate }: { reportId: string; canMutate: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!canMutate) return null;

  async function resolve(status: 'REVIEWED' | 'DISMISSED') {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => resolve('REVIEWED')}
        disabled={pending}
        className="rounded-md border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
      >
        Рассмотрено
      </button>
      <button
        type="button"
        onClick={() => resolve('DISMISSED')}
        disabled={pending}
        className="rounded-md border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground/50 transition-colors hover:bg-foreground/10 disabled:opacity-40"
      >
        Отклонить
      </button>
    </div>
  );
}
