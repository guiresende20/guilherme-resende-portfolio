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
