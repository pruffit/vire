'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

export function ReleaseShareButton(_props: { title: string; artistName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* нет доступа к буферу */
    }
  }

  return (
    <div className="relative inline-flex">
      <motion.button
        type="button"
        onClick={share}
        aria-label="Поделиться релизом"
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
              <CheckIcon />
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
              <ShareIcon />
            </motion.span>
          )}
        </AnimatePresence>
        {copied ? 'скопировано' : 'поделиться'}
      </motion.button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
