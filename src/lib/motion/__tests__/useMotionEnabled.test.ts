import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMotionEnabled } from "../useMotionEnabled";

function mockMatchMedia(map: Record<string, boolean>) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: map[q] ?? false,
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

describe("useMotionEnabled", () => {
  let restore: typeof window.matchMedia | undefined;
  beforeEach(() => { restore = window.matchMedia; });
  afterEach(() => { if (restore) window.matchMedia = restore; });

  it("returns true when reduced-motion=false and pointer=fine", () => {
    mockMatchMedia({
      "(prefers-reduced-motion: reduce)": false,
      "(pointer: coarse)": false,
    });
    const { result } = renderHook(() => useMotionEnabled());
    expect(result.current).toBe(true);
  });

  it("returns false when prefers-reduced-motion matches", () => {
    mockMatchMedia({
      "(prefers-reduced-motion: reduce)": true,
      "(pointer: coarse)": false,
    });
    const { result } = renderHook(() => useMotionEnabled());
    expect(result.current).toBe(false);
  });

  it("returns false when pointer is coarse (touch)", () => {
    mockMatchMedia({
      "(prefers-reduced-motion: reduce)": false,
      "(pointer: coarse)": true,
    });
    const { result } = renderHook(() => useMotionEnabled());
    expect(result.current).toBe(false);
  });
});
