/** Full-bleed ambient banner, neutral platform-tint version of the artist page's fallback banner. */
export function ProfileBanner() {
  return (
    <div aria-hidden className="relative w-full overflow-hidden" style={{ height: 'clamp(160px, 22vh, 280px)' }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 100% at 50% 0%, color-mix(in oklch, var(--primary) 20%, transparent), transparent 70%), linear-gradient(to bottom, transparent, var(--background))',
        }}
      />
    </div>
  );
}
