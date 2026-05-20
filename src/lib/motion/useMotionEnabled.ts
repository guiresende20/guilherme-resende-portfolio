import { useEffect, useState } from "react";

export function useMotionEnabled(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");

    const update = () => setEnabled(!reduce.matches && !coarse.matches);

    update();
    reduce.addEventListener("change", update);
    coarse.addEventListener("change", update);
    return () => {
      reduce.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
    };
  }, []);

  return enabled;
}
