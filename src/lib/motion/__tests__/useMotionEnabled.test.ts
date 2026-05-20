import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMotionEnabled } from "../useMotionEnabled";

type Listener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(map: Record<string, boolean>) {
  const listenersByQuery = new Map<string, Set<Listener>>();
  const mqls = new Map<string, { matches: boolean }>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => {
      if (!listenersByQuery.has(q)) listenersByQuery.set(q, new Set());
      if (!mqls.has(q)) mqls.set(q, { matches: map[q] ?? false });
      const state = mqls.get(q)!;
      return {
        get matches() { return state.matches; },
        media: q,
        addEventListener: (_: string, l: Listener) => listenersByQuery.get(q)!.add(l),
        removeEventListener: (_: string, l: Listener) => listenersByQuery.get(q)!.delete(l),
        dispatchEvent: () => true,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
      };
    }),
  });

  return {
    fire(q: string, next: boolean) {
      const state = mqls.get(q);
      if (state) state.matches = next;
      listenersByQuery.get(q)?.forEach((l) => l({ matches: next } as MediaQueryListEvent));
    },
  };
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

  it("reacts to runtime changes in prefers-reduced-motion", () => {
    const mm = mockMatchMedia({
      "(prefers-reduced-motion: reduce)": false,
      "(pointer: coarse)": false,
    });
    const { result } = renderHook(() => useMotionEnabled());
    expect(result.current).toBe(true);
    act(() => mm.fire("(prefers-reduced-motion: reduce)", true));
    expect(result.current).toBe(false);
  });
});
