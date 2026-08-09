'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { ShareIcon, CheckIcon } from '@/components/icons';

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
}

interface Props {
  code: string;
  title: string | null;
  basePath?: string;
}

export function JamShare({ code, title, basePath = '/jam' }: Props) {
  const t = useTranslations('jam.share');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function shareUrl(): string {
    return `${window.location.origin}${basePath}/${code}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* буфер недоступен */
    }
  }

  async function handleClick() {
    if (isTouchDevice() && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: title ?? t('titleFallback'), url: shareUrl() });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  return (
    <motion.button
      type="button"
      onClick={() => void handleClick()}
      aria-label={t('aria')}
      whileTap={{ scale: 0.9 }}
      transition={spring.snappy}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border px-3 sm:px-4 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    >
      {copied ? <CheckIcon size={14} /> : <ShareIcon size={14} />}
      <span className="hidden sm:inline">{copied ? t('copied') : t('share')}</span>
    </motion.button>
  );
}
