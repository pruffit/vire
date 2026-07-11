// Системные иконки (монохром, currentColor). Имена — из icon-manifest.generated.ts.
// Спрайт: public/icons/system-sprite.svg. Перегенерация: node scripts/build-icons.mjs.
import type { CSSProperties } from 'react';
import { SYSTEM_ICON_NAMES } from './icon-manifest.generated';

export const ICON_NAMES = SYSTEM_ICON_NAMES;

export type IconName = (typeof ICON_NAMES)[number];

export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`/icons/system-sprite.svg#vire-${name}`} />
    </svg>
  );
}
