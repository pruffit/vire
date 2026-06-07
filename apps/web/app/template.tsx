'use client';

import { motion } from 'motion/react';
import { ease } from '@vire/ui/motion';

/**
 * Плавное появление контента при навигации. template.tsx ремоунтится на каждый
 * переход, поэтому motion.div проигрывает enter-анимацию заново.
 *
 * Инвариант app-shell (важно — здесь уже ломали):
 *  - Обёртке нужна ЯВНАЯ высота `h-full` (height:100%), а НЕ `min-h-full`.
 *    Процентный `min-height` дочерних страниц (главная, профиль артиста с
 *    `min-h-full`) резолвится только против родителя с явной высотой; против
 *    `min-height`-родителя он по спеке схлопывается в 0 → страница не заполняет
 *    область. При `h-full` высота явная, а контент выше экрана всё равно уходит
 *    в скролл `#main-content` (overflow:visible пробрасывает overflow вверх).
 *  - Анимируем ТОЛЬКО opacity. Любой transform/filter создал бы containing block
 *    и сломал бы `position: fixed` (грейн-оверлей профиля артиста).
 */
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
