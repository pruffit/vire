import type { Transition } from 'motion/react';

/**
 * Единый словарь движения Vire — один источник правды для всех анимаций.
 *
 * Пружины задают «характер» интерфейса: snappy для тактильного отклика на тап,
 * smooth для разворотов/layout, gentle для мягких появлений. Кривая `soft`
 * совпадает с CSS-переменной `--ease-soft` (≈ easeOutQuint) из globals.css —
 * движение на motion и на чистом CSS читается одинаково.
 */

export const spring = {
  /** Короткая, но мягкая — тапы и нажатия. Без резкого «удара». */
  snappy: { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 },
  /** Сбалансированная — layout-переходы, разворот плеера, морфинг состояний. */
  smooth: { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 },
  /** Мягкая, с лёгкой инерцией — появления, scroll-reveal. */
  gentle: { type: 'spring', stiffness: 170, damping: 24, mass: 1 },
} satisfies Record<string, Transition>;

/** Кривая easeOutQuint — тот же `cubic-bezier(0.22, 1, 0.36, 1)`, что `--ease-soft`. */
export const ease = {
  soft: [0.22, 1, 0.36, 1],
} as const;

/** Длительности для tween-переходов (секунды), когда пружина не нужна. */
export const duration = {
  fast: 0.18,
  base: 0.32,
  slow: 0.5,
} as const;

/** Шаг каскада дочерних элементов в Stagger-контейнере (секунды). */
export const stagger = {
  tight: 0.035,
  base: 0.05,
  loose: 0.08,
} as const;
