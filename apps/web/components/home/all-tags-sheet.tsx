'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuickLookSheet } from '@/components/quick-look-sheet';
import { Icon } from '@/components/icon';
import { useWaveSeedStart } from '@/lib/use-wave-seed-start';
import { filterTagSections, type TagSheetSection, type WaveChipItem } from '@/components/home/wave-chip-items';

export function AllTagsSheet({
  open,
  onClose,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  sections: TagSheetSection[];
}) {
  const [query, setQuery] = useState('');
  const { loading, start } = useWaveSeedStart();
  const inputRef = useRef<HTMLInputElement>(null);

  // сброс через обёртку над onClose — каждый путь закрытия (Escape/backdrop/drag/выбор тега)
  // проходит через неё, следующее открытие стартует с чистого поиска
  const close = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => filterTagSections(sections, query), [sections, query]);

  async function handleTag(item: WaveChipItem) {
    await start(item);
    close();
  }

  return (
    <QuickLookSheet open={open} onClose={close}>
      <div className="px-5 pt-1 pb-3 space-y-3">
        <h2 className="text-base font-semibold">Все теги</h2>
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти тег…"
            aria-label="Найти тег"
            className="w-full min-h-11 rounded-full border border-border bg-foreground/[0.03] pl-9 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 space-y-5" data-scroll-area>
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Ничего не нашлось.</p>
        )}
        {filtered.map((section) => (
          <div key={section.label} className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{section.label}</h3>
            <div className="flex flex-wrap gap-2">
              {section.items.map((item) => (
                <button
                  key={`${item.kind}-${item.key}`}
                  type="button"
                  onClick={() => void handleTag(item)}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-foreground/5 transition-colors disabled:opacity-50"
                >
                  {item.label}
                  <span className="text-xs font-mono opacity-40">{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </QuickLookSheet>
  );
}
