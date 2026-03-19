import { useInView } from "./SectionHeader";
import type { ReactNode, CSSProperties } from "react";

interface Props {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
  className?: string;
  style?: CSSProperties;
}

export default function Reveal({ children, delay = 0, direction = "up", className = "", style }: Props) {
  const { ref, visible } = useInView(0.1);
  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(40px)",
    right: "translateX(-40px)",
    scale: "scale(0.95)",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : transforms[direction],
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
