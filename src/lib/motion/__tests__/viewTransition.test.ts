import { describe, it, expect, afterEach, vi } from "vitest";
import { navigateWithTransition } from "../viewTransition";

type MutableDoc = { startViewTransition?: unknown };

function setMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: q.includes("reduce") ? reduced : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
    })),
  });
}

describe("navigateWithTransition", () => {
  const docAny = document as unknown as MutableDoc;
  const originalStart = docAny.startViewTransition;
  const originalMM = window.matchMedia;

  afterEach(() => {
    docAny.startViewTransition = originalStart;
    if (originalMM) window.matchMedia = originalMM;
  });

  it("calls startViewTransition when supported and motion not reduced", () => {
    setMatchMedia(false);
    const start = vi.fn((cb: () => void) => cb());
    docAny.startViewTransition = start;
    const nav = vi.fn();
    navigateWithTransition(nav, "/blog");
    expect(start).toHaveBeenCalledTimes(1);
    expect(nav).toHaveBeenCalledWith("/blog");
  });

  it("calls navigate directly when startViewTransition not supported", () => {
    setMatchMedia(false);
    delete docAny.startViewTransition;
    const nav = vi.fn();
    navigateWithTransition(nav, "/blog");
    expect(nav).toHaveBeenCalledWith("/blog");
  });

  it("calls navigate directly when prefers-reduced-motion", () => {
    setMatchMedia(true);
    const start = vi.fn();
    docAny.startViewTransition = start;
    const nav = vi.fn();
    navigateWithTransition(nav, "/blog");
    expect(start).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith("/blog");
  });
});
