'use client';

import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

/**
 * 3D-тилт за курсором (desktop); лёгкий scale, чтобы при наклоне внутри
 * overflow-hidden не открывались края. На тач и reduced motion — noop.
 */
export function Tilt({
  children,
  max = 6,
  className,
}: {
  children: React.ReactNode;
  /** Максимальный наклон в градусах. */
  max?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const cfg = { stiffness: 300, damping: 30, mass: 0.8 };
  const rotateX = useSpring(useMotionValue(0), cfg);
  const rotateY = useSpring(useMotionValue(0), cfg);
  const scale = useSpring(useMotionValue(1), cfg);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(px * max * 2);
    rotateX.set(-py * max * 2);
    scale.set(1.04);
  }

  function onLeave() {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX, rotateY, scale, transformPerspective: 700 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
