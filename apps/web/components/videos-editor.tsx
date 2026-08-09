'use client';

import { useTranslations } from 'next-intl';
import type { ArtistVideo } from '@vire/core';
import { detectPlatform } from '@/lib/platforms';
import { PlatformIcon } from '@/components/platform-icon';
import { BrandGlyph, hasBrandGlyph } from '@/components/brand-glyph';
import { Icon } from '@/components/icon';
import { fieldClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { useStableListKeys } from '@/lib/use-stable-list-keys';

/** Редактор видео (YouTube/VK) — только ссылка; тайтл подтягивает сервер (lib/video-meta). */
export function VideosEditor({
  videos,
  onChange,
  max,
  disabled,
}: {
  videos: ArtistVideo[];
  onChange: (videos: ArtistVideo[]) => void;
  max: number;
  disabled?: boolean;
}) {
  const t = useTranslations('dashboard.videosEditor');
  const tPlatforms = useTranslations('platforms');
  const { keys, add: addKey, remove: removeKey } = useStableListKeys(videos.length);

  // При правке ссылки сбрасываем тайтл — он подтянется заново на сервере.
  const update = (i: number, url: string) =>
    onChange(videos.map((v, j) => (j === i ? { url, title: '' } : v)));
  const remove = (i: number) => {
    removeKey(i);
    onChange(videos.filter((_, j) => j !== i));
  };
  const add = () => {
    addKey();
    onChange([...videos, { url: '', title: '' }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{t('heading')}</span>
        <span className="text-xs text-foreground/30 tabular-nums">{videos.length}/{max}</span>
      </div>
      <p className="text-xs text-foreground/40 -mt-1">
        {t('hint')}
      </p>

      {videos.map((video, i) => {
        const { key } = detectPlatform(video.url, tPlatforms('website'));
        const glyph = !!video.url && hasBrandGlyph(key);
        return (
          <div key={keys[i]} className="flex items-start gap-2">
            {glyph ? (
              <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white">
                <BrandGlyph platform={key} size={20} />
              </span>
            ) : (
              <span className="shrink-0 w-9 h-9 grid place-items-center rounded-md bg-foreground/5 border border-foreground/10 text-foreground/60">
                <PlatformIcon platform="website" size={18} />
              </span>
            )}
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <input
                type="url"
                value={video.url}
                disabled={disabled}
                onChange={(e) => update(i, e.target.value)}
                placeholder={t('urlPlaceholder')}
                className={cn(fieldClass, 'w-full')}
              />
              {video.title && (
                <span className="text-xs text-foreground/40 truncate px-1">{video.title}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              className="shrink-0 mt-2 text-foreground/30 hover:text-red-400 transition-colors disabled:opacity-50"
              aria-label={t('removeAria')}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        );
      })}

      {videos.length < max && (
        <button
          type="button"
          disabled={disabled}
          onClick={add}
          className="self-start inline-flex items-center gap-1 text-sm text-foreground/50 hover:text-foreground/80 transition-colors mt-1 disabled:opacity-50"
        >
          <Icon name="plus" size={14} /> {t('addVideo')}
        </button>
      )}
    </div>
  );
}
