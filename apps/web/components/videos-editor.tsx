'use client';

import type { ArtistVideo } from '@vire/core';
import { detectPlatform } from '@/lib/platforms';
import { PlatformIcon } from '@/components/platform-icon';
import { BrandIcon, PLATFORM_BRAND } from '@/components/brand-icon';
import { Icon } from '@/components/icon';
import { fieldClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

/**
 * Редактор видео (YouTube/VK) — только ссылка. Название ролика подтягивается с
 * площадки на сервере при сохранении (см. lib/video-meta), поэтому текстового
 * поля тайтла нет. Известный тайтл показываем подписью под ссылкой.
 */
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
  const update = (i: number, url: string) =>
    onChange(videos.map((v, j) => (j === i ? { ...v, url } : v)));
  const remove = (i: number) => onChange(videos.filter((_, j) => j !== i));
  const add = () => onChange([...videos, { url: '', title: '' }]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Видео</span>
        <span className="text-xs text-foreground/30 tabular-nums">{videos.length}/{max}</span>
      </div>
      <p className="text-xs text-foreground/40 -mt-1">
        Вставь ссылку на ролик YouTube или VK — название подтянется само, плеер встроится на странице артиста.
      </p>

      {videos.map((video, i) => {
        const { key } = detectPlatform(video.url);
        const brand = video.url ? PLATFORM_BRAND[key] : null;
        return (
          <div key={i} className="flex items-start gap-2">
            {brand ? (
              <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white">
                <BrandIcon name={brand} size={18} />
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
                placeholder="https://youtube.com/watch?v=… или vk.com/video…"
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
              aria-label="Удалить видео"
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
          <Icon name="plus" size={14} /> добавить видео
        </button>
      )}
    </div>
  );
}
