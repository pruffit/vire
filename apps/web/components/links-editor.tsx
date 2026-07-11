'use client';

import type { ArtistLink } from '@vire/core';
import { detectPlatform, linkLabel } from '@/lib/platforms';
import { PlatformIcon } from '@/components/platform-icon';
import { PLATFORM_BRAND } from '@/components/brand-icon';
import { BrandGlyph, hasBrandGlyph } from '@/components/brand-glyph';
import { Icon } from '@/components/icon';
import { fieldClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { useStableListKeys } from '@/lib/use-stable-list-keys';

/**
 * Редактор ссылок на площадки/соцсети (смартлинк + профиль артиста). Площадка
 * определяется по URL; не распознали — даём поле текстовой подписи.
 */

export function LinksEditor({
  title,
  hint,
  links,
  onChange,
  max,
  disabled,
  addLabel = 'добавить ссылку',
}: {
  title: string;
  hint: string;
  links: ArtistLink[];
  onChange: (links: ArtistLink[]) => void;
  max: number;
  disabled?: boolean;
  addLabel?: string;
}) {
  const { keys, add: addKey, remove: removeKey } = useStableListKeys(links.length);

  const update = (i: number, patch: Partial<ArtistLink>) =>
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => {
    removeKey(i);
    onChange(links.filter((_, j) => j !== i));
  };
  const add = () => {
    addKey();
    onChange([...links, { url: '' }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-foreground/30 tabular-nums">{links.length}/{max}</span>
      </div>
      <p className="text-xs text-foreground/40 -mt-1">{hint}</p>

      {links.map((link, i) => (
        <LinkRow
          key={keys[i]}
          link={link}
          disabled={disabled}
          onUrl={(url) => update(i, { url })}
          onLabel={(label) => update(i, { label })}
          onRemove={() => remove(i)}
        />
      ))}

      {links.length < max && (
        <button
          type="button"
          disabled={disabled}
          onClick={add}
          className="self-start inline-flex items-center gap-1 text-sm text-foreground/50 hover:text-foreground/80 transition-colors mt-1 disabled:opacity-50"
        >
          <Icon name="plus" size={14} /> {addLabel}
        </button>
      )}
    </div>
  );
}

function LinkRow({
  link,
  disabled,
  onUrl,
  onLabel,
  onRemove,
}: {
  link: ArtistLink;
  disabled?: boolean;
  onUrl: (url: string) => void;
  onLabel: (label: string) => void;
  onRemove: () => void;
}) {
  const { key } = detectPlatform(link.url);
  const brand = link.url ? PLATFORM_BRAND[key] : null;
  const glyph = !!link.url && hasBrandGlyph(key);

  return (
    <div className="flex items-center gap-2">
      {glyph ? (
        <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white">
          <BrandGlyph platform={key} size={20} />
        </span>
      ) : (
        <span className="shrink-0 w-9 h-9 grid place-items-center rounded-md bg-foreground/5 border border-foreground/10 text-foreground/70">
          <PlatformIcon platform={link.url ? key : 'website'} size={18} />
        </span>
      )}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <input
          type="url"
          value={link.url}
          disabled={disabled}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="https://open.spotify.com/…"
          className={cn(fieldClass, 'w-full')}
        />
        {/* Подпись нужна только для нераспознанных ссылок — у площадки своё лого/название. */}
        {!brand && (
          <input
            type="text"
            value={link.label ?? ''}
            disabled={disabled}
            onChange={(e) => onLabel(e.target.value)}
            placeholder={link.url ? `Подпись (по умолчанию «${linkLabel(link.url)}»)` : 'Подпись (необязательно)'}
            className={cn(fieldClass, 'w-full text-xs')}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="shrink-0 mt-2 text-foreground/30 hover:text-red-400 transition-colors disabled:opacity-50"
        aria-label="Удалить ссылку"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
