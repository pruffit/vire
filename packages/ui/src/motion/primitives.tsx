'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps, type Variants } from 'motion/react';
import { spring, stagger as staggerTokens } from './tokens';

/**
 * Переиспользуемые motion-обёртки — публичный «язык движения» Vire.
 *
 * Все компоненты клиентские, но контент передаётся через `children`, который
 * приходит уже отрендеренным на сервере. Поэтому текст и разметка остаются в
 * исходном HTML (важно для SEO) — анимируется только обёртка.
 *
 * Reduced-motion соблюдается глобально через <MotionProvider reducedMotion="user">.
 */

type DivProps = HTMLMotionProps<'div'>;

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

/** Мягкое появление снизу вверх. Используется для заголовков и одиночных блоков. */
export function FadeUp({
  children,
  delay = 0,
  ...rest
}: DivProps & { delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeUpVariants}
      transition={{ ...spring.gentle, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Контейнер каскадного появления: дочерние <StaggerItem> всплывают по очереди.
 * Заменяет ручной `animationDelay` на элементах списка.
 */
export function Stagger({
  children,
  step = staggerTokens.base,
  ...rest
}: DivProps & { step?: number }) {
  const container: Variants = { hidden: {}, show: {} };
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      transition={{ staggerChildren: step, delayChildren: 0.04 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Элемент каскада внутри <Stagger>. */
export function StaggerItem({ children, ...rest }: DivProps) {
  return (
    <motion.div variants={fadeUpVariants} transition={spring.gentle} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Появление при попадании в вьюпорт (scroll-reveal) — для секций ниже сгиба.
 * Срабатывает один раз, чуть раньше полного входа в кадр.
 */
export function Reveal({ children, ...rest }: DivProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      variants={fadeUpVariants}
      transition={spring.gentle}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Тактильная обёртка: лёгкий подъём на ховере и «вдавливание» на нажатии.
 * Для произвольных кликабельных блоков (карточки, строки).
 */
export function Press({
  children,
  lift = -2,
  scaleDown = 0.97,
  ...rest
}: DivProps & { lift?: number; scaleDown?: number }) {
  return (
    <motion.div
      whileHover={{ y: lift }}
      whileTap={{ scale: scaleDown }}
      transition={spring.snappy}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
