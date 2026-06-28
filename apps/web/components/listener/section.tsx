import Link from 'next/link';
import { Icon } from '@/components/icon';

export function Section({
  title,
  count,
  href,
  hrefLabel,
  action,
  children,
}: {
  title: string;
  count?: number;
  href?: string;
  hrefLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-3">
          {href ? (
            <Link
              href={href}
              className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {hrefLabel ?? 'Все'}
              <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : count != null && count > 0 ? (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
          ) : null}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}
