'use client';

import * as React from 'react';
import { MotionConfig } from 'motion/react';

/**
 * Глобальный провайдер движения. `reducedMotion="user"` заставляет ВСЕ
 * motion-анимации уважать системную настройку «уменьшить движение» —
 * движение через transform/opacity глушится автоматически, без ручных проверок
 * в каждом компоненте. Дополняет CSS-правило prefers-reduced-motion в globals.css.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
