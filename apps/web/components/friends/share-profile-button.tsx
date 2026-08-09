'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icon';
import { ShareIcon, CheckIcon } from '@/components/icons';
import { Popover, PopoverItem, touchTargetClass } from '@/components/popover';

interface Props {
  userId: string;
}

/** Поповер «поделиться профилем»: navigator.share при поддержке, иначе копия ссылки. */
export function ShareProfileButton({ userId }: Props) {
  const t = useTranslations('social.shareProfile');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function profileUrl() {
    return `${window.location.origin}/u/${userId}`;
  }

  async function handleTrigger() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url: profileUrl() });
      } catch {
        /* пользователь отменил шаринг */
      }
      return;
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(profileUrl());
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1100);
    } catch {
      /* буфер недоступен */
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="right"
      drop="down"
      trigger={({ ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={handleTrigger}
          aria-label={t('aria')}
          className={`${touchTargetClass('md')} rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors`}
        >
          <ShareIcon />
        </button>
      )}
    >
      <PopoverItem
        label={copied ? t('copied') : t('copyLink')}
        onClick={copy}
        icon={copied ? <CheckIcon className="text-primary" /> : <Icon name="link" size={13} />}
      />
    </Popover>
  );
}
