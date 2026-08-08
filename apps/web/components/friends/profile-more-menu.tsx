'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { AdaptiveMenu } from '@/components/adaptive-menu';
import { Textarea, btnPrimary, btnGhost } from '@/components/ui-kit';
import { toast } from '@/lib/toast';

const REASON_MAX = 500;

export function ProfileMoreMenu({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | 'report' | 'block'>(null);

  return (
    <>
      <AdaptiveMenu
        open={open}
        onOpenChange={setOpen}
        align="right"
        trigger={({ toggle, ref }) => (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            aria-label="Ещё"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary/60 text-foreground/70 transition-colors hover:bg-secondary"
          >
            <Icon name="more-horizontal" size={18} />
          </button>
        )}
        items={[
          { label: 'Пожаловаться', icon: <Icon name="thumbs-down" size={15} />, onClick: () => setModal('report') },
          { label: 'Заблокировать', icon: <Icon name="ban" size={15} />, onClick: () => setModal('block') },
        ]}
      />

      {modal === 'report' && (
        <ReportModal targetUserId={targetUserId} onClose={() => setModal(null)} />
      )}
      {modal === 'block' && (
        <BlockConfirmModal
          targetUserId={targetUserId}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-background/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ReportModal({ targetUserId, onClose }: { targetUserId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    const trimmed = reason.trim();
    if (!trimmed || pending) return;
    setPending(true);
    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'USER', targetId: targetUserId, reason: trimmed }),
      });
      if (res.status === 409) {
        toast.error('Жалоба уже на рассмотрении');
        onClose();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast('Жалоба отправлена');
      onClose();
    } catch {
      setPending(false);
      toast.error('Не удалось отправить жалобу');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold">Пожаловаться на пользователя</h2>
      <p className="mt-1 text-sm text-muted-foreground">Опиши причину — жалобу рассмотрит модерация.</p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REASON_MAX}
        rows={4}
        placeholder="Причина"
        className="mt-4 w-full"
        autoFocus
      />
      <div className="mt-2 text-right text-xs text-muted-foreground/60">{reason.length}/{REASON_MAX}</div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnGhost}>Отмена</button>
        <button type="button" onClick={submit} disabled={!reason.trim() || pending} className={btnPrimary}>
          Отправить
        </button>
      </div>
    </Overlay>
  );
}

function BlockConfirmModal({
  targetUserId,
  onClose,
  onDone,
}: {
  targetUserId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function block() {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/users/${targetUserId}/block`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast('Пользователь заблокирован');
      onDone();
    } catch {
      setPending(false);
      toast.error('Не удалось заблокировать');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold">Заблокировать пользователя?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Вы перестанете быть друзьями, не сможете переписываться и видеть лайки друг друга.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnGhost}>Отмена</button>
        <button type="button" onClick={block} disabled={pending} className={`${btnPrimary} !bg-destructive`}>
          Заблокировать
        </button>
      </div>
    </Overlay>
  );
}
