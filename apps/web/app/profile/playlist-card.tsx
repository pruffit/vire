'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import type { PlaylistSummary } from '@vire/db';

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
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}
