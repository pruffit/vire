'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ease } from '@vire/ui/motion';

// SSR и первая гидрация рендерят контент видимым (initial=false): инлайн opacity:0
// до гидрации = чёрная страница, пока клиент грузит JS. Fade — только на клиентских
// переходах, когда JS гарантированно жив.
let hasNavigated = false;

// Ремоунтится на каждый переход — enter-анимация проигрывается заново.
// h-full, не min-h-full: min-height детей резолвится в 0 против min-height-родителя.
// Анимируем только opacity — transform/filter сломает position:fixed грейн-оверлея артиста.
export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hasNavigated = true;
  }, []);

  return (
    <motion.div
      initial={hasNavigated ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: ease.soft }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
