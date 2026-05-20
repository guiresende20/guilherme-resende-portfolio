# Wow Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three independent visual "wow factor" features to the portfolio (magnetic cursor, scroll hue shift, View Transitions API) in one branch / one PR.

**Architecture:** Shared `src/lib/motion/` module exposes a `useMotionEnabled` hook (false under `prefers-reduced-motion` or `pointer: coarse`) and a `navigateWithTransition` wrapper for the View Transitions API. Each feature is independent at runtime: a fixed full-screen `<canvas>` for the cursor mounted once in `App.tsx`; a `useFrame` inside the existing `PointCloud` for hue shift; a `TransitionLink` wrapper of react-router's `<Link>` for crossfade navigation.

**Tech Stack:** TypeScript, React, react-router-dom, @react-three/fiber, three.js, vitest + jsdom (existing), CSS view-transitions (native browser API).

**Spec:** `docs/superpowers/specs/2026-05-19-wow-quick-wins-design.md`

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/lib/motion/usePrefersReducedMotion.ts` | Hook: `true` if `prefers-reduced-motion: reduce`. Moved from `HeroScene3D.tsx`. |
| `src/lib/motion/useMotionEnabled.ts` | Hook: `false` if reduced-motion OR `pointer: coarse`. |
| `src/lib/motion/hue.ts` | Pure helper `hueFromProgress(p)`. |
| `src/lib/motion/viewTransition.ts` | `navigateWithTransition(navigate, to)` — wraps `document.startViewTransition`. |
| `src/lib/motion/cursorHelpers.ts` | Pure helpers `lerp`, `findClosestTarget`, `decayedTrail`. |
| `src/lib/motion/__tests__/usePrefersReducedMotion.test.ts` | Hook test (jsdom matchMedia mock). |
| `src/lib/motion/__tests__/useMotionEnabled.test.ts` | Hook test. |
| `src/lib/motion/__tests__/hue.test.ts` | Pure unit test. |
| `src/lib/motion/__tests__/viewTransition.test.ts` | Wrapper test (mocks). |
| `src/lib/motion/__tests__/cursorHelpers.test.ts` | Pure unit tests. |
| `src/components/MagneticCursor.tsx` | Canvas component, RAF loop, gated by `useMotionEnabled`. |
| `src/components/TransitionLink.tsx` | Drop-in `<Link>` replacement that calls `navigateWithTransition`. |

**Modified files:**

| Path | Change |
|---|---|
| `src/components/HeroScene3D.tsx` | Remove inline `usePrefersReducedMotion` (replace with import from `lib/motion/`); add scroll-progress ref + `useFrame` `setHSL` tint in `PointCloud`. |
| `src/App.tsx` | Mount `<MagneticCursor />` once. |
| `src/components/Navbar.tsx` | `<Link to="/blog">` → `<TransitionLink>`; mobile menu `<Link>` → `<TransitionLink>`; hamburger button gets `data-magnetic="off"`; language dropdown buttons get `data-magnetic="off"`. |
| `src/components/blog/PostCard.tsx` | `<Link>` → `<TransitionLink>`. |
| `src/pages/BlogTag.tsx` | `<Link to="/blog">` → `<TransitionLink>`. Also `PostCard` already covered. |
| `src/pages/BlogPost.tsx` | Flash fix: don't `setPost(null)` on slug change. Add `loading` state. Render previous post with `opacity-40` while loading. `<Link to="/blog">` → `<TransitionLink>` (top link + 404 fallback link). Tag links `<Link>` → `<TransitionLink>`. |
| `src/index.css` | Add `::view-transition-old(root) / -new(root)` rules. |

---

## Task 0: Create feature branch

**Skip if:** working in an isolated worktree already created via `superpowers:using-git-worktrees`.

- [ ] **Step 1: Verify on `main` and clean**

Run: `git status && git branch --show-current`
Expected: clean working tree, branch `main`.

- [ ] **Step 2: Create and switch to feature branch**

Run: `git checkout -b feat/wow-quick-wins-1-2-3`
Expected: `Switched to a new branch 'feat/wow-quick-wins-1-2-3'`.

---

## Task 1: Move `usePrefersReducedMotion` into `src/lib/motion/`

**Why first:** Item #3 (`navigateWithTransition`) uses `matchMedia` directly inline, but item #1 and `useMotionEnabled` both reuse this hook. Centralising avoids duplication.

**Files:**
- Create: `src/lib/motion/usePrefersReducedMotion.ts`
- Create: `src/lib/motion/__tests__/usePrefersReducedMotion.test.ts`
- Modify: `src/components/HeroScene3D.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/motion/__tests__/usePrefersReducedMotion.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

type Listener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    dispatchEvent: () => true,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return {
    mql,
    fire: (next: boolean) => {
      mql.matches = next;
      listeners.forEach((l) => l({ matches: next } as MediaQueryListEvent));
    },
  };
}

describe("usePrefersReducedMotion", () => {
  let restore: typeof window.matchMedia | undefined;

  beforeEach(() => {
    restore = window.matchMedia;
  });

  afterEach(() => {
    if (restore) window.matchMedia = restore;
  });

  it("returns true when media query matches", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false when media query does not match", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("reacts to runtime changes", () => {
    const mm = mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => mm.fire(true));
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Verify `@testing-library/react` is installed**

Run: `node -e "require('@testing-library/react')"`
Expected: no error. If error, install: `npm install -D @testing-library/react`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/motion/__tests__/usePrefersReducedMotion.test.ts`
Expected: FAIL — file `../usePrefersReducedMotion` not found.

- [ ] **Step 4: Create `src/lib/motion/usePrefersReducedMotion.ts`**

```ts
import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/motion/__tests__/usePrefersReducedMotion.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Refactor `HeroScene3D.tsx` to import from new location**

Edit `src/components/HeroScene3D.tsx`:

Replace lines 154–167 (the inline `usePrefersReducedMotion` declaration) with nothing (delete the function definition).

Add to the imports section at the top of the file (after the `import * as THREE` line):

```ts
import { usePrefersReducedMotion } from "../lib/motion/usePrefersReducedMotion";
```

The existing call site at line 170 (`const prefersReducedMotion = usePrefersReducedMotion();`) requires no change — it now resolves to the imported function.

- [ ] **Step 7: Run type-check and existing tests to confirm no regression**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (all existing tests + new 3 motion tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/motion/usePrefersReducedMotion.ts src/lib/motion/__tests__/usePrefersReducedMotion.test.ts src/components/HeroScene3D.tsx
git commit -m "refactor(motion): extract usePrefersReducedMotion into src/lib/motion/"
```

---

## Task 2: Add `useMotionEnabled` hook

**Files:**
- Create: `src/lib/motion/useMotionEnabled.ts`
- Create: `src/lib/motion/__tests__/useMotionEnabled.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/motion/__tests__/useMotionEnabled.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/motion/__tests__/useMotionEnabled.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useMotionEnabled.ts`**

Create `src/lib/motion/useMotionEnabled.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/motion/__tests__/useMotionEnabled.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion/useMotionEnabled.ts src/lib/motion/__tests__/useMotionEnabled.test.ts
git commit -m "feat(motion): add useMotionEnabled hook (reduced-motion + pointer:coarse)"
```

---

## Task 3: Add `hueFromProgress` pure helper

**Files:**
- Create: `src/lib/motion/hue.ts`
- Create: `src/lib/motion/__tests__/hue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/motion/__tests__/hue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hueFromProgress } from "../hue";

describe("hueFromProgress", () => {
  it("starts at 0.4 (neon green hue) when progress is 0", () => {
    expect(hueFromProgress(0)).toBeCloseTo(0.4, 5);
  });

  it("advances linearly with progress", () => {
    expect(hueFromProgress(0.3)).toBeCloseTo(0.7, 5);
  });

  it("wraps around past 1.0", () => {
    expect(hueFromProgress(0.7)).toBeCloseTo(0.1, 5);
    expect(hueFromProgress(1)).toBeCloseTo(0.4, 5);
  });

  it("clamps inputs below 0 to 0", () => {
    expect(hueFromProgress(-0.5)).toBeCloseTo(0.4, 5);
  });

  it("clamps inputs above 1 to 1", () => {
    expect(hueFromProgress(1.5)).toBeCloseTo(0.4, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/motion/__tests__/hue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `hue.ts`**

Create `src/lib/motion/hue.ts`:

```ts
export function hueFromProgress(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  return (0.4 + clamped) % 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/motion/__tests__/hue.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion/hue.ts src/lib/motion/__tests__/hue.test.ts
git commit -m "feat(motion): add hueFromProgress helper"
```

---

## Task 4: Verify three.js `vertexColors` + `material.color` behavior

**Why:** The `PointCloud` material uses `vertexColors: true`. Setting `material.color` is expected to multiply the per-vertex colors. If this assumption is wrong, the visual breaks. Confirm before wiring.

- [ ] **Step 1: Query Context7 for `PointsMaterial` + `vertexColors` interaction**

Use the `mcp__plugin_context7_context7__resolve-library-id` tool with `three.js`, then `mcp__plugin_context7_context7__query-docs` with the resolved ID and the query: "PointsMaterial vertexColors color tint multiplication behavior".

Read the result. Look for confirmation that `material.color` is multiplied against the per-vertex color attribute when `vertexColors: true`.

- [ ] **Step 2: Decide branch based on docs**

- If docs confirm multiplication → proceed to Task 5 unchanged (Plan A).
- If docs reveal a gotcha → choose Plan B (disable vertexColors during tint) or Plan C (ShaderMaterial with `uTint` uniform). Document the chosen plan inline as a comment in Task 5 before implementing.

- [ ] **Step 3: Record finding**

No commit. Write a 1-line summary in the chat: e.g., "Context7 confirmed PointsMaterial.color multiplies vertexColors — proceeding with Plan A".

---

## Task 5: Wire scroll hue shift into `HeroScene3D`

**Files:**
- Modify: `src/components/HeroScene3D.tsx`

- [ ] **Step 1: Add imports**

In `src/components/HeroScene3D.tsx`, near the existing imports, add:

```ts
import { hueFromProgress } from "../lib/motion/hue";
import { useMotionEnabled } from "../lib/motion/useMotionEnabled";
```

- [ ] **Step 2: Add scroll-progress ref and listener in `PointCloud`**

Inside the `PointCloud` function, after the existing `useRef` declarations (`pointsRef`, `lineRef`), add a new ref and listener:

```ts
const scrollProgressRef = useRef(0);
const motionEnabled = useMotionEnabled();
const pointsMaterialRef = useRef<THREE.PointsMaterial>(null);
const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);

useEffect(() => {
  const update = () => {
    const scrollTop = document.documentElement.scrollTop;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgressRef.current = scrollable > 0 ? scrollTop / scrollable : 0;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
  return () => window.removeEventListener("scroll", update);
}, []);
```

- [ ] **Step 3: Extend the existing `useFrame` to apply hue**

Modify the existing `useFrame` callback (currently at lines 73–85). Append to it:

```ts
useFrame(({ clock, pointer }) => {
  const t = clock.getElapsedTime();
  if (pointsRef.current) {
    pointsRef.current.rotation.y = t * 0.045 + pointer.x * 0.12;
    pointsRef.current.rotation.x = -0.12 + pointer.y * 0.06;
    pointsRef.current.position.y = Math.sin(t * 0.45) * 0.08;
  }
  if (lineRef.current) {
    lineRef.current.rotation.y = t * 0.045 + pointer.x * 0.12;
    lineRef.current.rotation.x = -0.12 + pointer.y * 0.06;
    lineRef.current.position.y = Math.sin(t * 0.45) * 0.08;
  }
  if (motionEnabled) {
    const hue = hueFromProgress(scrollProgressRef.current);
    if (pointsMaterialRef.current) {
      pointsMaterialRef.current.color.setHSL(hue, 0.85, 0.55);
    }
    if (lineMaterialRef.current) {
      lineMaterialRef.current.color.setHSL(hue, 0.85, 0.55);
    }
  }
});
```

- [ ] **Step 4: Attach material refs in JSX**

In the same file, find the `<pointsMaterial ... />` (around line 94–103) and add `ref={pointsMaterialRef}`:

```tsx
<pointsMaterial
  ref={pointsMaterialRef}
  vertexColors
  map={particleTexture ?? undefined}
  size={0.026}
  sizeAttenuation
  transparent
  opacity={0.82}
  alphaTest={0.01}
  depthWrite={false}
/>
```

And the `<lineBasicMaterial ... />` (around line 109):

```tsx
<lineBasicMaterial ref={lineMaterialRef} color="#00ff87" transparent opacity={0.12} />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Run existing tests**

Run: `npx vitest run`
Expected: PASS (no regression — no test of HeroScene3D exists).

- [ ] **Step 7: Smoke the dev server visually**

Run: `npm run dev` (in background). Open `http://localhost:5173/`. Scroll the page; particles should change hue. Stop the server.

Note: visual validation only — no automated test for the WebGL output.

- [ ] **Step 8: Commit**

```bash
git add src/components/HeroScene3D.tsx
git commit -m "feat(hero): scroll-driven HSL hue shift on particles + lines"
```

---

## Task 6: Add cursor pure helpers

**Files:**
- Create: `src/lib/motion/cursorHelpers.ts`
- Create: `src/lib/motion/__tests__/cursorHelpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/motion/__tests__/cursorHelpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lerp, findClosestTarget, decayedTrail } from "../cursorHelpers";

describe("lerp", () => {
  it("returns a when t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it("returns b when t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("interpolates linearly", () => {
    expect(lerp(0, 100, 0.25)).toBe(25);
  });
});

function rect(x: number, y: number, w = 10, h = 10): DOMRect {
  return {
    x, y, width: w, height: h,
    top: y, left: x, right: x + w, bottom: y + h,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("findClosestTarget", () => {
  it("returns null when no rects within radius", () => {
    const result = findClosestTarget([rect(500, 500)], { x: 0, y: 0 }, 80);
    expect(result).toBeNull();
  });

  it("returns the closest rect within radius", () => {
    const r1 = rect(100, 100);
    const r2 = rect(20, 20);
    const result = findClosestTarget([r1, r2], { x: 25, y: 25 }, 80);
    expect(result?.rect).toBe(r2);
  });

  it("uses the rect center for distance", () => {
    // rect at (0,0,10,10) has center (5,5); distance from (105,5) is 100
    const r = rect(0, 0);
    const result = findClosestTarget([r], { x: 105, y: 5 }, 80);
    expect(result).toBeNull();
    const result2 = findClosestTarget([r], { x: 105, y: 5 }, 120);
    expect(result2?.rect).toBe(r);
  });
});

describe("decayedTrail", () => {
  it("returns empty array when positions empty", () => {
    expect(decayedTrail([], 8)).toEqual([]);
  });

  it("returns up to count frames, newest first", () => {
    const positions = [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 },
    ];
    const trail = decayedTrail(positions, 8);
    expect(trail).toHaveLength(4);
    expect(trail[0]).toMatchObject({ x: 3, y: 3 });
  });

  it("decays opacity and radius linearly with index", () => {
    const positions = Array.from({ length: 8 }, (_, i) => ({ x: i, y: 0 }));
    const trail = decayedTrail(positions, 8);
    expect(trail[0].opacity).toBeCloseTo(0.6);
    expect(trail[0].radius).toBe(12);
    expect(trail[7].opacity).toBeCloseTo((1 - 7 / 8) * 0.6);
    expect(trail[7].radius).toBe(5);
  });

  it("caps output at `count` frames", () => {
    const positions = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 0 }));
    const trail = decayedTrail(positions, 8);
    expect(trail).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/motion/__tests__/cursorHelpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cursorHelpers.ts`**

Create `src/lib/motion/cursorHelpers.ts`:

```ts
export type Point = { x: number; y: number };
export type TrailFrame = { x: number; y: number; opacity: number; radius: number };

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function findClosestTarget(
  rects: DOMRect[],
  mouse: Point,
  radius: number,
): { rect: DOMRect; distance: number } | null {
  let best: { rect: DOMRect; distance: number } | null = null;
  for (const r of rects) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - mouse.x;
    const dy = cy - mouse.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= radius && (best === null || d < best.distance)) {
      best = { rect: r, distance: d };
    }
  }
  return best;
}

export function decayedTrail(positions: Point[], count: number): TrailFrame[] {
  if (positions.length === 0) return [];
  const recent = positions.slice(-count).reverse();
  return recent.map((p, i) => ({
    x: p.x,
    y: p.y,
    opacity: (1 - i / count) * 0.6,
    radius: 12 - i,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/motion/__tests__/cursorHelpers.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion/cursorHelpers.ts src/lib/motion/__tests__/cursorHelpers.test.ts
git commit -m "feat(motion): add pure helpers for magnetic cursor (lerp, findClosestTarget, decayedTrail)"
```

---

## Task 7: Create `MagneticCursor` component + mount in App

**Files:**
- Create: `src/components/MagneticCursor.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Navbar.tsx` (data-magnetic="off" markers only)

- [ ] **Step 1: Implement `MagneticCursor.tsx`**

Create `src/components/MagneticCursor.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useMotionEnabled } from "../lib/motion/useMotionEnabled";
import {
  lerp,
  findClosestTarget,
  decayedTrail,
  type Point,
} from "../lib/motion/cursorHelpers";

const NEON = "#00ff87";
const MAGNET_RADIUS = 80;
const TRAIL_COUNT = 8;
const TARGET_SELECTOR =
  'a[href], button, [role="button"], [data-magnetic]';

export default function MagneticCursor() {
  const motionEnabled = useMotionEnabled();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!motionEnabled) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9998";
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const mouse: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let cursorPos: Point = { ...mouse };
    const trail: Point[] = [];
    let raf = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    const tick = () => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(TARGET_SELECTOR),
      ).filter((el) => el.getAttribute("data-magnetic") !== "off");

      const rects = els.map((el) => el.getBoundingClientRect());
      const closest = findClosestTarget(rects, mouse, MAGNET_RADIUS);

      if (closest) {
        const tx = closest.rect.left + closest.rect.width / 2;
        const ty = closest.rect.top + closest.rect.height / 2;
        cursorPos = {
          x: lerp(cursorPos.x, tx, 0.18),
          y: lerp(cursorPos.y, ty, 0.18),
        };
      } else {
        cursorPos = {
          x: lerp(cursorPos.x, mouse.x, 0.4),
          y: lerp(cursorPos.y, mouse.y, 0.4),
        };
      }

      trail.push({ ...cursorPos });
      if (trail.length > TRAIL_COUNT * 2) trail.splice(0, trail.length - TRAIL_COUNT * 2);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";

      // trail (oldest-to-newest order via decayedTrail returns newest-first;
      // draw newest last for proper layering)
      const frames = decayedTrail(trail, TRAIL_COUNT);
      for (let i = frames.length - 1; i >= 0; i--) {
        const f = frames[i];
        ctx.beginPath();
        ctx.fillStyle = NEON;
        ctx.globalAlpha = f.opacity;
        ctx.arc(f.x, f.y, Math.max(1, f.radius), 0, Math.PI * 2);
        ctx.fill();
      }

      // outline ring
      ctx.globalAlpha = 1;
      ctx.strokeStyle = NEON;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      // inner dot
      ctx.fillStyle = NEON;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, 2, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [motionEnabled]);

  return null;
}
```

- [ ] **Step 2: Mount in `App.tsx`**

Edit `src/App.tsx`. Add the import:

```ts
import MagneticCursor from "./components/MagneticCursor";
```

Wrap the `<BrowserRouter>` block with a fragment and add `<MagneticCursor />` next to it:

```tsx
export default function App() {
  return (
    <>
      <MagneticCursor />
      <BrowserRouter>
        <Routes>
          {/* unchanged */}
        </Routes>
      </BrowserRouter>
    </>
  );
}
```

- [ ] **Step 3: Add `data-magnetic="off"` to language buttons and hamburger in Navbar**

Edit `src/components/Navbar.tsx`:

On the hamburger `<button>` (currently around line 138–146), add `data-magnetic="off"`:

```tsx
<button
  onClick={() => setMobileOpen(!mobileOpen)}
  className="md:hidden flex flex-col items-center justify-center w-10 h-10 gap-1.5 relative z-[60]"
  aria-label="Menu"
  data-magnetic="off"
>
```

On the desktop language switcher button (around line 110–116), add `data-magnetic="off"`:

```tsx
<button
  onClick={() => setLangMenuOpen(!langMenuOpen)}
  className="hidden md:inline-flex items-center gap-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-background bg-[#00ff87] px-4 py-2.5 hover:opacity-90 transition-opacity"
  data-magnetic="off"
>
```

On the three language dropdown buttons inside `{langMenuOpen && ...}` (around line 119–123), add `data-magnetic="off"` to each:

```tsx
<button onClick={() => changeLanguage('pt')} data-magnetic="off" className={`px-4 py-2 text-left text-[11px] font-sans uppercase font-bold tracking-[0.06em] hover:bg-[#00ff87]/10 ${i18n.language === 'pt' ? 'text-[#00ff87]' : 'text-muted-foreground'}`}>PT</button>
<button onClick={() => changeLanguage('en')} data-magnetic="off" className={`px-4 py-2 text-left text-[11px] font-sans uppercase font-bold tracking-[0.06em] hover:bg-[#00ff87]/10 ${i18n.language === 'en' ? 'text-[#00ff87]' : 'text-muted-foreground'}`}>EN</button>
<button onClick={() => changeLanguage('es')} data-magnetic="off" className={`px-4 py-2 text-left text-[11px] font-sans uppercase font-bold tracking-[0.06em] hover:bg-[#00ff87]/10 ${i18n.language === 'es' ? 'text-[#00ff87]' : 'text-muted-foreground'}`}>ES</button>
```

On the mobile-menu language buttons (around line 200–212), add `data-magnetic="off"`:

```tsx
{["pt", "en", "es"].map((lng) => (
  <button
    key={lng}
    onClick={() => { changeLanguage(lng); setMobileOpen(false); }}
    data-magnetic="off"
    className={/* unchanged */}
  >
```

On the mobile-menu `<Link>` and `<a>` items inside the overlay (around line 161–188), add `data-magnetic="off"` so the cursor doesn't grab elements behind the overlay:

```tsx
<Link
  key={l.to}
  to={l.to}
  onClick={() => setMobileOpen(false)}
  data-magnetic="off"
  /* ... */
>
```

And the `<a>` siblings:

```tsx
<a
  key={l.href}
  href={l.href}
  onClick={(e) => handleClick(e, l.href!)}
  data-magnetic="off"
  /* ... */
>
```

And the mobile GPT link near the bottom (around line 215–227):

```tsx
<a
  href="https://chatgpt.com/g/g-68654885f5c88191b5d2df8265320cce-guilherme-resende-gpt"
  target="_blank"
  rel="noopener noreferrer"
  data-magnetic="off"
  /* ... */
>
```

- [ ] **Step 4: Type-check + run all tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Smoke locally**

Run: `npm run dev` (background). Open `http://localhost:5173/`. Move mouse — neon cursor with trail visible; pulls into navbar links and the GPT CTA; ignores the language pill and hamburger. Open mobile menu (resize browser to mobile width); cursor should not be magnetic to mobile-menu items (because `data-magnetic="off"`). Stop server.

- [ ] **Step 6: Commit**

```bash
git add src/components/MagneticCursor.tsx src/App.tsx src/components/Navbar.tsx
git commit -m "feat(cursor): magnetic neon cursor with trail, gated by useMotionEnabled"
```

---

## Task 8: Add `navigateWithTransition` wrapper

**Files:**
- Create: `src/lib/motion/viewTransition.ts`
- Create: `src/lib/motion/__tests__/viewTransition.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/motion/__tests__/viewTransition.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { navigateWithTransition } from "../viewTransition";

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
  const originalStart = (document as Document & { startViewTransition?: unknown }).startViewTransition;
  const originalMM = window.matchMedia;

  afterEach(() => {
    (document as Document & { startViewTransition?: unknown }).startViewTransition = originalStart;
    if (originalMM) window.matchMedia = originalMM;
  });

  it("calls startViewTransition when supported and motion not reduced", () => {
    setMatchMedia(false);
    const start = vi.fn((cb: () => void) => cb());
    (document as Document & { startViewTransition?: unknown }).startViewTransition = start;
    const nav = vi.fn();
    navigateWithTransition(nav, "/blog");
    expect(start).toHaveBeenCalledTimes(1);
    expect(nav).toHaveBeenCalledWith("/blog");
  });

  it("calls navigate directly when startViewTransition not supported", () => {
    setMatchMedia(false);
    delete (document as Document & { startViewTransition?: unknown }).startViewTransition;
    const nav = vi.fn();
    navigateWithTransition(nav, "/blog");
    expect(nav).toHaveBeenCalledWith("/blog");
  });

  it("calls navigate directly when prefers-reduced-motion", () => {
    setMatchMedia(true);
    const start = vi.fn();
    (document as Document & { startViewTransition?: unknown }).startViewTransition = start;
    const nav = vi.fn();
    navigateWithTransition(nav, "/blog");
    expect(start).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith("/blog");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/motion/__tests__/viewTransition.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `viewTransition.ts`**

Create `src/lib/motion/viewTransition.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/motion/__tests__/viewTransition.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion/viewTransition.ts src/lib/motion/__tests__/viewTransition.test.ts
git commit -m "feat(motion): add navigateWithTransition wrapper for View Transitions API"
```

---

## Task 9: Create `TransitionLink` component

**Files:**
- Create: `src/components/TransitionLink.tsx`

- [ ] **Step 1: Implement `TransitionLink.tsx`**

Create `src/components/TransitionLink.tsx`:

```tsx
import { Link, useNavigate, type LinkProps } from "react-router-dom";
import { navigateWithTransition } from "../lib/motion/viewTransition";

export default function TransitionLink(props: LinkProps) {
  const navigate = useNavigate();
  const { to, onClick, ...rest } = props;

  return (
    <Link
      {...rest}
      to={to}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented) return;
        if (typeof to !== "string") return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigateWithTransition(navigate, to);
      }}
    />
  );
}
```

Note: This wrapper preserves modifier-key behavior (cmd-click, middle-click) by bailing out and letting the browser handle the click natively.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TransitionLink.tsx
git commit -m "feat(link): TransitionLink wrapper of react-router Link"
```

---

## Task 10: Add view-transition CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Append view-transition rules**

Open `src/index.css`. Append at the end of the file:

```css
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 250ms;
    animation-timing-function: ease-out;
  }
}
```

- [ ] **Step 2: Confirm build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style(motion): tune view-transition crossfade duration to 250ms"
```

---

## Task 11: Fix BlogPost flash (don't `setPost(null)` on slug change)

**Files:**
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Replace state management**

Open `src/pages/BlogPost.tsx`. Replace the `useEffect` block (currently lines 48–60) and add a `loading` state.

Change the state declarations (currently lines 42–46):

```tsx
const [post, setPost] = useState<PostResponse | null>(null);
const [notFound, setNotFound] = useState(false);
const [error, setError] = useState<string | null>(null);
const [translatedBody, setTranslatedBody] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
```

Replace the existing `useEffect` (lines 48–60):

```tsx
useEffect(() => {
  if (!slug) return;
  setNotFound(false);
  setError(null);
  setTranslatedBody(null);
  setLoading(true);
  fetchPost(slug)
    .then((p) => {
      if (!p) {
        setPost(null);
        setNotFound(true);
      } else {
        setPost(p);
      }
    })
    .catch((e) => setError(String(e)))
    .finally(() => setLoading(false));
}, [slug]);
```

Note: the only difference from before is removing the `setPost(null)` call before fetching, and adding `setLoading(true)` / `.finally(setLoading(false))`. `post` now keeps its previous value during slug change.

- [ ] **Step 2: Adjust the "no post yet" fallback**

The existing block (currently lines 96–104):

```tsx
if (!post) {
  return (
    <BlogLayout>
      <div className="container mx-auto px-6 py-16 text-muted-foreground">
        Carregando…
      </div>
    </BlogLayout>
  );
}
```

now only triggers on the very first load (before `post` ever existed). On subsequent slug changes, `post` retains the previous value, so this branch is skipped and the JSX below renders the old post.

- [ ] **Step 3: Add fade-during-loading wrapper around main content**

Find the outer wrapper (currently line 110–112):

```tsx
return (
  <BlogLayout>
    <div className="container mx-auto px-6 py-16">
```

Change to:

```tsx
return (
  <BlogLayout>
    <div
      className="container mx-auto px-6 py-16 transition-opacity duration-200"
      style={{ opacity: loading ? 0.4 : 1 }}
    >
```

- [ ] **Step 4: Manually test the flash fix locally**

Run: `npm run dev` (background). Open `http://localhost:5173/blog/teste-de-audio`. Click a tag link (e.g. `#audio` if the post has one) — observe: previous content stays visible (faded) until new post arrives; no white flash. Stop the server.

- [ ] **Step 5: Type-check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/BlogPost.tsx
git commit -m "fix(blog): keep previous post during slug change to enable crossfade"
```

---

## Task 12: Substitute `<Link>` for `<TransitionLink>` at navigation points

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/blog/PostCard.tsx`
- Modify: `src/pages/BlogTag.tsx`
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Navbar — desktop blog link + mobile menu blog link**

Edit `src/components/Navbar.tsx`.

Replace the import line:

```ts
import { Link, useLocation, useNavigate } from "react-router-dom";
```

with:

```ts
import { useLocation, useNavigate } from "react-router-dom";
import TransitionLink from "./TransitionLink";
```

Then in the rendered JSX, replace all `<Link ...>` / `</Link>` with `<TransitionLink ...>` / `</TransitionLink>` (there are two — one in desktop links around line 86–92, one in mobile menu around line 161–173).

- [ ] **Step 2: PostCard — full card link**

Edit `src/components/blog/PostCard.tsx`.

Replace import:

```ts
import { Link } from "react-router-dom";
```

with:

```ts
import TransitionLink from "../TransitionLink";
```

Replace the JSX `<Link>...</Link>` with `<TransitionLink>...</TransitionLink>` (one occurrence — the outer wrapper).

- [ ] **Step 3: BlogTag — back-to-blog link**

Edit `src/pages/BlogTag.tsx`.

Replace import:

```ts
import { useParams, Link } from "react-router-dom";
```

with:

```ts
import { useParams } from "react-router-dom";
import TransitionLink from "../components/TransitionLink";
```

Replace the `<Link to="/blog" ...>` (around line 25) with `<TransitionLink to="/blog" ...>` and its closing tag.

- [ ] **Step 4: BlogPost — back-to-blog link, tag links, and 404 fallback**

Edit `src/pages/BlogPost.tsx`.

Replace import:

```ts
import { useParams, Link } from "react-router-dom";
```

with:

```ts
import { useParams } from "react-router-dom";
import TransitionLink from "../components/TransitionLink";
```

Substitute all `<Link>` for `<TransitionLink>`:
- Line ~67: `<Link to="/blog" ...>← Voltar para o blog</Link>` (error branch).
- Line ~84: `<Link to="/blog" ...>← Voltar para o blog</Link>` (notFound branch).
- Lines ~118: `<Link to="/blog" ...>← blog</Link>` (main header back link).
- Lines ~139–146: `<Link to={...}>#{t}</Link>` inside the tags `.map()` — substitute to `<TransitionLink>`.

- [ ] **Step 5: Type-check + tests + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: PASS.

- [ ] **Step 6: Smoke locally**

Run: `npm run dev` (background). Open `http://localhost:5173/`. Click navbar "BLOG" — crossfade should be visible (in Chrome). Click a post card — crossfade. Click a tag link inside a post — crossfade. Stop server.

- [ ] **Step 7: Commit**

```bash
git add src/components/Navbar.tsx src/components/blog/PostCard.tsx src/pages/BlogTag.tsx src/pages/BlogPost.tsx
git commit -m "feat(transition): wire TransitionLink at all router navigation points"
```

---

## Task 13: Cross-cutting verification + branch wrap-up

- [ ] **Step 1: Confirm branch is the right name**

Run: `git branch --show-current`
Expected: `feat/wow-quick-wins-1-2-3`. If still on `main`, abort and ask the user how to proceed (this plan assumed a feature branch was created before Task 1 — if not, the prior commits need to be moved).

- [ ] **Step 2: Final gates**

Run, in order:

```bash
npx tsc --noEmit
npx eslint src --ext .ts,.tsx
npx vitest run
npm run build
```

Each expected: PASS.

If `eslint` is not configured, skip that step.

- [ ] **Step 3: Bundle delta measurement**

Run: `ls -la dist/assets/*.js | sort -k5 -n` (Bash). Note the sizes of the main `index-*.js` and `Blog-*.js` chunks.

Compare to the previous build (the user can provide pre-feature sizes from `main` if needed; otherwise record current numbers in the PR body as baseline).

- [ ] **Step 4: Programmatic smokes against local production build**

Run: `npm run build && npm run preview` (background). With preview server running on the printed port:

```bash
curl -s http://localhost:4173/ | grep -i '<title>' && echo "OK /"
curl -s http://localhost:4173/blog | grep -iq 'blog' && echo "OK /blog"
curl -s http://localhost:4173/blog/teste-de-audio | grep -i 'teste' && echo "OK post"
```

Each expected: print `OK ...`. Stop the preview server.

- [ ] **Step 5: Lighthouse (optional, requires Chrome)**

Run: `npx --yes lighthouse http://localhost:4173/ --only-categories=performance,accessibility --form-factor=mobile --output=json --output-path=/tmp/lh.json --chrome-flags="--headless"`

Then: `cat /tmp/lh.json | node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/lh.json'));console.log('perf', d.categories.performance.score, 'a11y', d.categories.accessibility.score)"`

Expected: both ≥ 0.95. If below, investigate before opening PR.

- [ ] **Step 6: Push branch and open PR**

```bash
git push -u origin feat/wow-quick-wins-1-2-3
gh pr create --title "feat: wow quick wins (magnetic cursor + scroll hue + view transitions)" --body "$(cat <<'EOF'
## Summary
- Magnetic neon cursor on desktop (canvas 2D, RAF, lerp magnetism on CTAs)
- Scroll-driven HSL hue rotation on hero particles
- Native View Transitions API crossfade on react-router navigation (Chromium); degrades cleanly in Firefox/Safari

All three respect `prefers-reduced-motion`. Cursor also respects `pointer: coarse`.

Spec: `docs/superpowers/specs/2026-05-19-wow-quick-wins-design.md`

## Test plan
- [ ] Open Deploy Preview on Chrome desktop
- [ ] Confirm cursor follows mouse, attracts to navbar links, ignores hamburger and language pill
- [ ] Scroll the home; particle color shifts through hue wheel
- [ ] Click navbar "BLOG"; observe crossfade
- [ ] Click a post card; observe crossfade
- [ ] Click tag link inside post; observe crossfade
- [ ] Resize to mobile width; cursor disappears, hue still rotates
- [ ] DevTools → emulate prefers-reduced-motion; cursor disappears, hue stops, transitions skip
- [ ] Lighthouse mobile perf + a11y ≥ 95

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Post-merge cleanup (after squash-merge in main)**

Run:

```bash
git checkout main
git pull --ff-only
git branch -d feat/wow-quick-wins-1-2-3
```

---

## Self-Review Notes

After the plan was written, the following checks were applied inline:

- **Spec coverage:** Each spec section maps to at least one task. Architecture overview → Tasks 1–9 (file structure); Feature 1 → Tasks 6–7; Feature 2 → Tasks 3–5; Feature 3 → Tasks 8–12; Cross-cutting → Task 13.
- **Placeholder scan:** No "TBD", "TODO", or "implement later" in task code blocks. The Context7 query in Task 4 is a real action with a decision gate.
- **Type consistency:** `Point`, `TrailFrame`, `NavigateFunction` consistent across files. `findClosestTarget` returns `{ rect, distance } | null` in both helper and consumer.
- **Naming consistency:** `useMotionEnabled` used in Cursor + Hero; `usePrefersReducedMotion` only used internally by `navigateWithTransition` (via direct `matchMedia` call) and the existing hero a11y fallback.
- **One spec deviation noted and resolved:** spec listed `<Link>` substitution only in Navbar/PostCard/BlogTag, with BlogPost as "if there are Links to other slugs". Plan resolves this: BlogPost has 4 Link occurrences (back, tags, error fallback, notFound fallback) — all swapped.
