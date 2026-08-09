'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/icon';
import { AdaptiveMenu } from '@/components/adaptive-menu';
import { Textarea, btnPrimary, btnGhost } from '@/components/ui-kit';
import { toast } from '@/lib/toast';

const REASON_MAX = 500;

export function ProfileMoreMenu({ targetUserId }: { targetUserId: string }) {
  const t = useTranslations('social.profileMenu');
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
            aria-label={t('moreAria')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary/60 text-foreground/70 transition-colors hover:bg-secondary"
          >
            <Icon name="more-horizontal" size={18} />
          </button>
        )}
        items={[
          { label: t('report'), icon: <Icon name="thumbs-down" size={15} />, onClick: () => setModal('report') },
          { label: t('block'), icon: <Icon name="ban" size={15} />, onClick: () => setModal('block') },
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
  const t = useTranslations('social.profileMenu.reportModal');
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
        toast.error(t('alreadyPending'));
        onClose();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast(t('sent'));
      onClose();
    } catch {
      setPending(false);
      toast.error(t('sendFailed'));
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('hint')}</p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REASON_MAX}
        rows={4}
        placeholder={t('placeholder')}
        className="mt-4 w-full"
        autoFocus
      />
      <div className="mt-2 text-right text-xs text-muted-foreground/60">{reason.length}/{REASON_MAX}</div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnGhost}>{t('cancel')}</button>
        <button type="button" onClick={submit} disabled={!reason.trim() || pending} className={btnPrimary}>
          {t('send')}
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
  const t = useTranslations('social.profileMenu.blockModal');
  const [pending, setPending] = useState(false);

  async function block() {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/users/${targetUserId}/block`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast(t('success'));
      onDone();
    } catch {
      setPending(false);
      toast.error(t('failed'));
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('body')}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnGhost}>{t('cancel')}</button>
        <button type="button" onClick={block} disabled={pending} className={`${btnPrimary} !bg-destructive`}>
          {t('confirm')}
        </button>
      </div>
    </Overlay>
  );
}
