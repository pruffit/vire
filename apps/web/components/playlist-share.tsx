'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { ShareIcon, CheckIcon } from '@/components/icons';
import { Icon } from '@/components/icon';
import { Popover, PopoverItem, touchTargetClass } from '@/components/popover';
import { toast } from '@/lib/toast';

interface Props {
  playlistId: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  isOwner: boolean;
}

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
}

export function PlaylistShare({ playlistId, title, visibility: propVisibility, isOwner }: Props) {
  const t = useTranslations('playlist');
  const [optimisticVisibility, setOptimisticVisibility] = useState<'PRIVATE' | 'PUBLIC' | null>(null);
  const [syncedProp, setSyncedProp] = useState(propVisibility);
  if (propVisibility !== syncedProp) {
    setSyncedProp(propVisibility);
    setOptimisticVisibility(null);
  }
  const visibility = optimisticVisibility ?? propVisibility;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (visibility === 'PRIVATE' && !isOwner) return null;

  function shareUrl(): string {
    return `${window.location.origin}/playlists/${playlistId}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { setCopied(false); setOpen(false); }, 1100);
    } catch {
      /* буфер недоступен */
    }
  }

  async function makePublicAndShare() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/v1/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'PUBLIC' }),
      });
      if (!res.ok) throw new Error();
      setOptimisticVisibility('PUBLIC');
      router.refresh();
      await copyLink();
    } catch {
      toast.error(t('share.publishFailed'));
    } finally {
      setPublishing(false);
    }
  }

  async function handleTrigger(toggle: () => void) {
    if (visibility !== 'PUBLIC' || !isTouchDevice() || typeof navigator.share !== 'function') {
      toggle();
      return;
    }
    try {
      await navigator.share({ title, url: shareUrl() });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
    await copyLink();
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={({ open: expanded, toggle, ref }) => (
        <motion.button
          ref={ref}
          type="button"
          onClick={() => void handleTrigger(toggle)}
          aria-label={t('share.aria')}
          aria-expanded={expanded}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          className={`${touchTargetClass('sm')} rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer`}
        >
          <ShareIcon />
        </motion.button>
      )}
    >
      {visibility === 'PUBLIC' ? (
        <PopoverItem
          label={copied ? t('copied') : t('copyLink')}
          icon={copied ? <CheckIcon /> : <Icon name="link" size={13} />}
          onClick={() => void copyLink()}
        />
      ) : (
        <PopoverItem
          label={copied ? t('copied') : publishing ? t('share.publishing') : t('share.makePublic')}
          icon={copied ? <CheckIcon /> : publishing ? <Icon name="loader" size={13} className="animate-spin" /> : <Icon name="globe" size={13} />}
          onClick={() => void makePublicAndShare()}
          disabled={publishing}
        />
      )}
    </Popover>
  );
}
