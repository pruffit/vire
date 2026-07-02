'use client';

import * as React from 'react';
import { MotionConfig } from 'motion/react';
import { useReduceMotionPref } from './reduce-motion';
import { REDUCE_MOTION_CLASS } from './reduce-motion-constants';

/**
 * Глобальный провайдер движения. `reducedMotion="user"` заставляет ВСЕ
 * motion-анимации уважать системную настройку «уменьшить движение» —
 * движение через transform/opacity глушится автоматически, без ручных проверок
 * в каждом компоненте. Дополняет CSS-правило prefers-reduced-motion в globals.css.
 *
 * Дополнительно читает явный тумблер пользователя (localStorage, см.
 * AppearanceSettings в /profile): форсирует `reducedMotion="always"` для motion/react
 * И держит класс `vire-reduce-motion` на <html> — чтобы CSS-keyframe-анимации
 * (`animate-fade-up` и пр.) глушились на ВСЕХ страницах, а не только там, где
 * смонтирован тумблер. Провайдер живёт в корневом layout, поэтому класс синхронен
 * всегда. Первый пейнт закрыт инлайн-скриптом REDUCE_MOTION_INIT_SCRIPT.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotionPref();

  React.useEffect(() => {
    document.documentElement.classList.toggle(REDUCE_MOTION_CLASS, reduce);
  }, [reduce]);

  return <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>{children}</MotionConfig>;
}
