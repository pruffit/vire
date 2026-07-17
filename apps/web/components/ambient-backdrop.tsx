/** Родитель должен быть `relative overflow-hidden`, контент поверх — `relative z-10`. */
export function AmbientBackdrop({ src }: { src?: string | null }) {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[75vh] pointer-events-none overflow-hidden">
      {src && (
        <div
          className="absolute inset-0 scale-125"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(72px) saturate(1.5)',
            opacity: 0.4,
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 0%, color-mix(in oklch, var(--artist-accent) 22%, transparent), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, color-mix(in oklch, var(--artist-bg) 35%, transparent), var(--artist-bg))' }}
      />
    </div>
  );
}
