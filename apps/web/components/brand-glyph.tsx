import type { PlatformKey } from '@/lib/platforms';
import { PLATFORM_BRAND } from '@/components/brand-icon';
import { BRAND_GLYPH_NAMES } from './icon-manifest.generated';

/**
 * Компактный квадратный глиф бренда для мелких строк редактора (профиль,
 * смартлинк-форма). Файлы: public/icons/brands-glyph/<name>.svg (источник —
 * icons/brand-glyph). Это НЕ вордмарки из BrandIcon — те шире и нужны на
 * лендингах смартлинков.
 */
const GLYPH_SET = new Set<string>(BRAND_GLYPH_NAMES);

/** Есть ли компактный глиф для этой площадки. */
export function hasBrandGlyph(platform: PlatformKey): boolean {
  const brand = PLATFORM_BRAND[platform];
  return !!brand && GLYPH_SET.has(brand);
}

export function BrandGlyph({
  platform,
  size = 20,
  className,
}: {
  platform: PlatformKey;
  size?: number;
  className?: string;
}) {
  const brand = PLATFORM_BRAND[platform];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- статичный бренд-SVG
    <img
      src={`/icons/brands-glyph/${brand}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
