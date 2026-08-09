'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { PlaylistSummary } from '@vire/db';
import { Icon } from '@/components/icon';
import { PlaylistCover } from '@/components/playlist-cover';
import { PlaylistPeekSheet } from '@/components/playlist-quick-look';

interface Props {
  playlist: PlaylistSummary;
}

export function PlaylistCard({ playlist }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <a
          href={`/playlists/${playlist.id}`}
          onClick={(e) => { e.preventDefault(); setOpen(true); }}
          className="group block w-full text-left space-y-2"
        >
          <div className="aspect-square rounded-xl overflow-hidden bg-card border border-border relative">
            <PlaylistCover
              covers={playlist.covers}
              title={playlist.title}
              variant="mosaic"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 300px"
              imageClassName="transition-transform duration-300 group-hover:scale-105"
            />
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
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              {t('common.trackCountShort', { count: playlist.trackCount })}
              {playlist.role === 'COLLABORATOR' && (
                <span className="inline-flex items-center gap-0.5 text-muted-foreground/70">
                  <Icon name="users" size={10} /> {t('nav.playlistCard.collaborative')}
                </span>
              )}
            </p>
          </div>
        </a>
      </motion.div>

      <PlaylistPeekSheet
        playlistId={playlist.id}
        title={playlist.title}
        trackCount={playlist.trackCount}
        covers={playlist.covers}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function LockIcon() {
  return <Icon name="lock" size={10} />;
}
