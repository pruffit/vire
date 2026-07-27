import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'overlap' | 'detail' | 'compact';
type SpaceY = '8' | '10' | '14' | '16' | 'home';

const BASE = 'w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8';

const VARIANT_CLASS: Record<Variant, string> = {
  default: 'py-12',
  overlap: 'pb-16 -mt-16 sm:-mt-24 relative z-10',
  detail: 'relative z-10',
  compact: 'py-4 lg:py-6',
};

// Литералы держим здесь целиком — Tailwind должен видеть полный класс в исходнике,
// не собранный из фрагментов в рантайме.
const SPACE_Y_CLASS: Record<SpaceY, string> = {
  '8': 'space-y-8',
  '10': 'space-y-10',
  '14': 'space-y-14',
  '16': 'space-y-16',
  home: 'space-y-10 sm:space-y-16',
};

interface PageContainerProps {
  variant?: Variant;
  spaceY?: SpaceY;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  variant = 'default',
  spaceY,
  as: Component = 'main',
  className,
  children,
}: PageContainerProps) {
  return (
    <Component className={cn(BASE, VARIANT_CLASS[variant], spaceY && SPACE_Y_CLASS[spaceY], className)}>
      {children}
    </Component>
  );
}
