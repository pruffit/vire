'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { spring } from '@vire/ui/motion';
import { ShareIcon, CheckIcon } from '@/components/icons';

export function ReleaseShareButton(_props: { title: string; artistName: string }) {
  const t = useTranslations('release.share');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* нет доступа к буферу */
    }
  }

  return (
    <div className="relative inline-flex">
      <motion.button
        type="button"
        onClick={share}
        aria-label={t('aria')}
        whileTap={{ scale: 0.88 }}
        transition={spring.snappy}
        className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono border transition-colors"
        style={{
          borderColor: 'color-mix(in oklch, var(--artist-text) 25%, transparent)',
          color: copied ? 'var(--artist-accent, currentColor)' : undefined,
          opacity: 0.6,
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={spring.snappy}
              className="flex items-center justify-center"
            >
              <CheckIcon size={12} />
            </motion.span>
          ) : (
            <motion.span
              key="share"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={spring.snappy}
              className="flex items-center justify-center"
            >
              <ShareIcon size={12} />
            </motion.span>
          )}
        </AnimatePresence>
        {copied ? t('copied') : t('cta')}
      </motion.button>
    </div>
  );
}
