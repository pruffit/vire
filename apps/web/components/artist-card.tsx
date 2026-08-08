'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';
import { resolveAvatarUrl } from '@/lib/avatar';

export interface ArtistCardProps {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  coverFallbackUrl?: string | null;
  verified: boolean;
  stat?: string | null;
  sizes?: string;
  variant?: 'grid' | 'chip';
}

const DEFAULT_GRID_SIZES = '(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw';

export function ArtistCard(props: ArtistCardProps) {
  return props.variant === 'chip' ? <ArtistChipCard {...props} /> : <ArtistGridCard {...props} />;
}

function ArtistGridCard({ slug, name, avatarUrl, coverFallbackUrl, verified, stat, sizes }: ArtistCardProps) {
  const avatar = resolveAvatarUrl(avatarUrl, coverFallbackUrl);
  return (
    <Link href={`/artists/${slug}`} className="block">
      <motion.article whileHover={{ y: -2 }} transition={spring.snappy} className="group space-y-3 text-center">
        <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-lg group-hover:shadow-black/20">
          {avatar ? (
            <Image
              src={avatar}
              alt={name}
              fill
              sizes={sizes ?? DEFAULT_GRID_SIZES}
              className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-mono text-muted-foreground">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="space-y-0.5 px-1">
          <p className="text-sm font-medium leading-snug truncate transition-colors">
            {name}
            {verified && (
              <Icon name="check" size={12} className="ml-1 inline-block align-middle text-muted-foreground" />
            )}
          </p>
          {stat && <p className="text-xs text-muted-foreground font-mono tabular-nums">{stat}</p>}
        </div>
      </motion.article>
    </Link>
  );
}

function ArtistChipCard({ slug, name, avatarUrl, coverFallbackUrl, verified, stat, sizes }: ArtistCardProps) {
  const avatar = resolveAvatarUrl(avatarUrl, coverFallbackUrl);
  const [preview, setPreview] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function enter() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ left: r.left + r.width / 2, top: r.top - 8 });
      setPreview(true);
    }, 300);
  }
  function leave() {
    if (timer.current) clearTimeout(timer.current);
    setPreview(false);
  }

  return (
    <div ref={wrapRef} onMouseEnter={enter} onMouseLeave={leave}>
      <Link href={`/artists/${slug}`} className="block group text-center">
        <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20">
          {avatar ? (
            <Image src={avatar} alt={name} fill sizes={sizes ?? '(max-width: 640px) 33vw, 128px'} className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          ) : (
            <div className="w-full h-full grid place-items-center text-xl font-mono text-muted-foreground">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs font-medium leading-snug truncate group-hover:text-foreground transition-colors">
          {name}
        </p>
      </Link>

      {/* Портал + fixed — иначе поповер клипает overflow-x у ScrollRow-rail'а */}
      {pos && createPortal(
        <span
          style={{ position: 'fixed', left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)' }}
          className="pointer-events-none z-50"
        >
          <AnimatePresence onExitComplete={() => { if (!preview) setPos(null); }}>
            {preview && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={spring.smooth}
                className="w-44 rounded-xl bg-popover border border-border shadow-2xl p-3 flex items-center gap-3"
              >
                <span className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-muted">
                  {avatar ? (
                    <Image src={avatar} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-sm font-mono text-muted-foreground">{name[0]?.toUpperCase()}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-medium truncate">
                    {name}
                    {verified && <Icon name="check" size={12} className="text-muted-foreground shrink-0" />}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {stat ? stat : <>Открыть <Icon name="arrow-right" size={11} /></>}
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </span>,
        document.body
      )}
    </div>
  );
}
