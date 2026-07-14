import { Section } from '@/components/listener/section';

function CoverCard({ width, round }: { width: string; round?: boolean }) {
  return (
    <div className={`shrink-0 ${width} space-y-2.5`} aria-hidden="true">
      <div className={`aspect-square bg-foreground/[0.04] ${round ? 'rounded-full' : 'rounded-md'}`} />
      <div className="h-3.5 w-3/4 rounded bg-foreground/[0.04]" />
      <div className="h-3 w-1/2 rounded bg-foreground/[0.04]" />
    </div>
  );
}

export function RailSkeleton({ title, cardWidth, count = 8, href, hrefLabel, round }: {
  title: string;
  cardWidth: string;
  count?: number;
  href?: string;
  hrefLabel?: string;
  round?: boolean;
}) {
  return (
    <Section title={title} href={href} hrefLabel={hrefLabel}>
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: count }, (_, i) => <CoverCard key={i} width={cardWidth} round={round} />)}
      </div>
    </Section>
  );
}

export function TrackListSkeleton({ title, rows = 8, href, hrefLabel }: {
  title: string;
  rows?: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <Section title={title} href={href} hrefLabel={hrefLabel}>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/60" aria-hidden="true">
            <div className="w-9 h-9 shrink-0 rounded-sm bg-foreground/[0.04]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-2/5 rounded bg-foreground/[0.04]" />
              <div className="h-3 w-1/4 rounded bg-foreground/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
