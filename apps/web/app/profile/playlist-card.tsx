'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import type { PlaylistSummary } from '@vire/db';
import { Icon } from '@/components/icon';

interface Props {
  playlist: PlaylistSummary;
}

export function PlaylistCard({ playlist }: Props) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Link href={`/playlists/${playlist.id}`} className="group block space-y-2">
        <div className="aspect-square rounded-xl overflow-hidden bg-card border border-border relative">
          {playlist.coverUrl ? (
            <Image
              src={playlist.coverUrl}
              alt={playlist.title}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20">
              <PlaylistIcon />
            </div>
          )}
          {playlist.visibility === 'PRIVATE' && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-background/70 flex items-center justify-center backdrop-blur-sm">
              <LockIcon />
            </div>
          )}
        </div>
        <div className="space-y-0.5 px-0.5">
          <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
            {playlist.title}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {playlist.trackCount} тр.
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

function PlaylistIcon() {
  return <Icon name="list" size={28} />;
}

function LockIcon() {
  return <Icon name="lock" size={10} />;
}
