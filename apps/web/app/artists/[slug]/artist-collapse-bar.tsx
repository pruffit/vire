'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

/**
 * Компактная липкая полоска артиста: появляется, когда крупный hero ушёл за
 * верх скролл-области (сентинел + IntersectionObserver), въезжает пружиной
 * под навбар. Клик — плавный скролл к началу страницы.
 */
export function ArtistCollapseBar({
  name,
  avatarUrl,
  verified,
}: {
  name: string;
  avatarUrl: string | null;
  verified: boolean;
}) {
  const [show, setShow] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const root = document.getElementById('main-content');
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { root },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function scrollTop() {
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {/* Сентинел на границе hero и контента */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px -mt-px" />

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -56, opacity: 0 }}
            transition={spring.smooth}
            className="fixed top-12 inset-x-0 z-20 backdrop-blur-md"
            style={{
              background: 'color-mix(in oklch, var(--artist-bg) 80%, transparent)',
              borderBottom: '1px solid color-mix(in oklch, var(--artist-text) 8%, transparent)',
            }}
          >
            <button
              type="button"
              onClick={scrollTop}
              aria-label="Наверх страницы"
              className="mx-auto max-w-4xl px-6 h-11 flex items-center gap-3 w-full text-left text-[var(--artist-text)]"
            >
              {avatarUrl ? (
                <span className="relative w-6 h-6 rounded-full overflow-hidden shrink-0">
                  <Image src={avatarUrl} alt="" fill quality={60} sizes="24px" className="object-cover" />
                </span>
              ) : (
                <span className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
              )}
              <span className="text-sm font-semibold truncate">{name}</span>
              {verified && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label="Верифицирован"
                  className="shrink-0"
                  style={{ color: 'var(--artist-accent)' }}
                >
                  <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8L12 2z" />
                </svg>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
