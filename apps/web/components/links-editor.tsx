'use client';

import type { ArtistLink } from '@vire/core';
import { detectPlatform, linkLabel } from '@/lib/platforms';
import { PlatformIcon } from '@/components/platform-icon';
import { BrandIcon, PLATFORM_BRAND, isBrandWordmark } from '@/components/brand-icon';
import { Icon } from '@/components/icon';
import { fieldClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

/**
 * Единый редактор списка ссылок на площадки/соцсети — общий для смартлинка и
 * профиля артиста (раньше это были два разных редактора, делавших одно и то же
 * по-разному). Площадка определяется по URL: распознали — показываем лого и
 * подпись подхватывается сама; не распознали — даём поле текстовой подписи.
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
  const update = (i: number, patch: Partial<ArtistLink>) =>
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => onChange(links.filter((_, j) => j !== i));
  const add = () => onChange([...links, { url: '' }]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-foreground/30 tabular-nums">{links.length}/{max}</span>
      </div>
      <p className="text-xs text-foreground/40 -mt-1">{hint}</p>

      {links.map((link, i) => (
        <LinkRow
          key={i}
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

  return (
    <div className="flex items-center gap-2">
      {brand ? (
        <span className="shrink-0 inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-white px-2">
          <BrandIcon name={brand} size={isBrandWordmark(brand) ? 14 : 18} />
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
