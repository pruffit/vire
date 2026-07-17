import Image from 'next/image';

export function CoverPlaceholder({ iconSize = 34 }: { iconSize?: number }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-linear-to-br from-white/[0.07] to-white/[0.01]">
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="opacity-20">
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6zm0 16a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
      </svg>
    </div>
  );
}

interface PlaylistCoverProps {
  covers: string[];
  title: string;
  /** 'mosaic' — сетка 2×2 при ≥4 уникальных обложках (шапка, карточка); 'single' — всегда
   *  первая обложка (сайдбар 40px: четыре картинки читаются как шум). */
  variant: 'mosaic' | 'single';
  sizes: string;
  quality?: number;
  placeholderIconSize?: number;
  imageClassName?: string;
}

export function PlaylistCover({
  covers,
  title,
  variant,
  sizes,
  quality = 70,
  placeholderIconSize,
  imageClassName,
}: PlaylistCoverProps) {
  const unique = Array.from(new Set(covers.filter(Boolean)));

  if (unique.length === 0) return <CoverPlaceholder iconSize={placeholderIconSize} />;

  if (variant === 'single' || unique.length < 4) {
    return (
      <Image
        src={unique[0]!}
        alt={title}
        fill
        sizes={sizes}
        quality={quality}
        className={`object-cover${imageClassName ? ` ${imageClassName}` : ''}`}
      />
    );
  }

  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-black/40">
      {unique.slice(0, 4).map((src) => (
        <div key={src} className="relative overflow-hidden">
          <Image
            src={src}
            alt=""
            fill
            sizes={sizes}
            quality={quality}
            className={`object-cover${imageClassName ? ` ${imageClassName}` : ''}`}
          />
        </div>
      ))}
    </div>
  );
}
