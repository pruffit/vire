/**
 * Размытая обложка как ambient-свет вверху страницы, плавно гаснет в фон артиста.
 * Родитель должен быть `relative overflow-hidden`, контент поверх — `relative z-10`.
 */
export function AmbientBackdrop({ src }: { src: string }) {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[75vh] pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 scale-125"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(72px) saturate(1.5)',
          opacity: 0.32,
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, color-mix(in oklch, var(--artist-bg) 35%, transparent), var(--artist-bg))' }}
      />
    </div>
  );
}
