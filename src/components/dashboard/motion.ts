import type { Transition, Variants } from "motion/react";

// Entrance choreography: header → KPIs → charts, each a short fade + rise.
const ENTER: Transition = { duration: 0.36, ease: "easeOut" };

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: ENTER },
};
