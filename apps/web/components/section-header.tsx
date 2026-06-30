export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className="font-mono text-xs uppercase tracking-[0.25em]"
        style={{ color: 'var(--artist-accent)' }}
      >
        {label}
      </span>
      <span
        className="h-px flex-1"
        style={{ background: 'color-mix(in oklch, var(--artist-text) 14%, transparent)' }}
      />
    </div>
  );
}
