import { useEffect, useState } from "react";

function computeInitial(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return !reduce && !coarse;
}

export function useMotionEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(computeInitial);

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
