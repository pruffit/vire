'use client';

import * as React from 'react';
import { MotionConfig } from 'motion/react';
import { useReduceMotionPref } from './reduce-motion';
import { REDUCE_MOTION_CLASS } from './reduce-motion-constants';

// reducedMotion="user" глушит все motion-анимации по системной настройке; тумблер
// пользователя (localStorage) форсирует "always" и держит класс vire-reduce-motion
// на <html>, чтобы CSS-keyframe-анимации глушились и вне смонтированного тумблера.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotionPref();

  React.useEffect(() => {
    document.documentElement.classList.toggle(REDUCE_MOTION_CLASS, reduce);
  }, [reduce]);

  return <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>{children}</MotionConfig>;
}
