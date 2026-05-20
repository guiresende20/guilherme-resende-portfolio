import type { NavigateFunction } from "react-router-dom";

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => void;
};

export function navigateWithTransition(
  navigate: NavigateFunction,
  to: string,
): void {
  const doc = document as DocWithVT;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof doc.startViewTransition === "function" && !reduced) {
    doc.startViewTransition(() => navigate(to));
  } else {
    navigate(to);
  }
}
