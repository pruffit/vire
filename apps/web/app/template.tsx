'use client';

import { motion } from 'motion/react';
import { ease } from '@vire/ui/motion';

// Ремоунтится на каждый переход — enter-анимация проигрывается заново.
// h-full, не min-h-full: min-height детей резолвится в 0 против min-height-родителя.
// Анимируем только opacity — transform/filter сломает position:fixed грейн-оверлея артиста.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: ease.soft }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
