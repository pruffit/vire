'use client';

import { useEffect, useState } from 'react';
import { cn } from '@vire/ui';

interface TocItem {
  id: string;
  n: number;
  title: string;
}

/**
 * Липкое оглавление правовой страницы с подсветкой активной секции (scroll-spy
 * через IntersectionObserver). Скрыто на мобиле — там просто читается сверху вниз.
 */
export function LegalToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const nodes = items
      .map((i) => document.getElementById(i.id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Оглавление" className="mb-10 hidden lg:block">
      <ul className="sticky top-8 space-y-1 border-l border-border">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cn(
                  '-ml-px flex gap-2 border-l-2 py-1 pl-4 text-xs transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="font-mono tabular-nums text-primary/70">
                  {String(item.n).padStart(2, '0')}
                </span>
                <span className="leading-snug">{item.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
