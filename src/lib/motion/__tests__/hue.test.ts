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
