'use client';

import { motion } from 'motion/react';
import { ease } from '@vire/ui/motion';

/**
 * Плавный переход между роутами. template.tsx ремоунтится на каждую навигацию —
 * поэтому motion.div проигрывает enter-анимацию при каждом переходе.
 *
 * Важно для app-shell:
 *  - `min-h-full` пробрасывает высоту скролл-области дальше вниз, иначе страницы
 *    с `min-h-full` (главная, профиль артиста) потеряют опору и фон не заполнит
 *    область. Без `min-h-screen` — инвариант защищён layout-shell.test.
 *  - анимируем ТОЛЬКО opacity. Любой `transform`/`filter` на обёртке создал бы
 *    containing block и сломал `position: fixed` (грейн-оверлей профиля артиста).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: ease.soft }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
