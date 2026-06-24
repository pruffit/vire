'use client';

import { useTransition } from 'react';
import { actionRetryQueueFailed, actionCleanQueueFailed } from './actions';

export function QueueFailedActions({ queueName }: { queueName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => startTransition(() => actionRetryQueueFailed(queueName))}
        title="Вернуть упавшие задачи в очередь (нужен запущенный worker)"
        className="text-xs font-mono px-2 py-0.5 rounded border border-foreground/15 text-foreground/50 hover:border-foreground/30 hover:text-foreground/80 transition-colors disabled:opacity-40"
      >
        {pending ? '…' : 'повторить все'}
      </button>
      <button
        disabled={pending}
        onClick={() => startTransition(() => actionCleanQueueFailed(queueName))}
        title="Удалить упавшие задачи из Redis без повтора"
        className="text-xs font-mono px-2 py-0.5 rounded border border-red-500/25 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
      >
        очистить
      </button>
    </div>
  );
}
