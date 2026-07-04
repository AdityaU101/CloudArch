import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  /** Prefix such as "$". */
  prefix?: string;
  /** Decimal places to render. */
  decimals?: number;
  className?: string;
}

/**
 * Smoothly tweens between numeric values. Used for the live cost counter so
 * cost changes feel like a physical readout rather than a hard swap.
 */
export function AnimatedNumber({ value, prefix = "", decimals = 0, className }: AnimatedNumberProps) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (latest) =>
    prefix + latest.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  );

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [value, mv]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
