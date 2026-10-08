"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";

/** Counts up from the previous value (0 on mount) to `value`; jumps straight there under reduced motion. */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, format);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: reduceMotion ? 0 : 0.9,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [motionValue, reduceMotion, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
