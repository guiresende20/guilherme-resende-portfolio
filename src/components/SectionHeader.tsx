import { useRef, useState, useEffect } from "react";

interface SectionHeaderProps {
  label: string;
  title: string;
  titleOutline?: string;
  subtitle?: string;
  id?: string;
}

export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export default function SectionHeader({ label, title, titleOutline, subtitle, id }: SectionHeaderProps) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      id={id}
      className="mb-16"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(40px)",
        transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-px bg-neon" />
        <span className="font-mono text-[11px] font-medium text-neon uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <h2 className="font-display font-bold text-foreground uppercase tracking-[-0.03em] leading-[0.95]"
        style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>
        {title}
        {titleOutline && (
          <>
            <br />
            <span className="text-outline">{titleOutline}</span>
          </>
        )}
      </h2>
      {subtitle && (
        <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}
