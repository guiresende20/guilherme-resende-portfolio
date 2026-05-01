import { useInView } from "./SectionHeader";
import type { ReactNode, CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
  className?: string;
  style?: CSSProperties;
}

export default function Reveal({ children, delay = 0, direction = "up", className = "", style }: Props) {
  const { ref, visible } = useInView(0.1);
  const prefersReducedMotion = useReducedMotion();
  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(40px)",
    right: "translateX(-40px)",
    scale: "scale(0.95)",
  };

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : transforms[direction],
      }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}
