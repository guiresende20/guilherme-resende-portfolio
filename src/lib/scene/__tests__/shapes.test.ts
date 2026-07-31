import { describe, it, expect } from "vitest";
import {
  generateProjectGrid,
  generateSpiralCloud,
  PROJECT_GRID_TOTAL_HEIGHT,
  PROJECT_GRID_TOTAL_WIDTH,
} from "../shapes";

describe("generateSpiralCloud", () => {
  it("returns a Float32Array of length count * 3", () => {
    const cloud = generateSpiralCloud(900);
    expect(cloud).toBeInstanceOf(Float32Array);
    expect(cloud.length).toBe(2700);
  });

  it("produces only finite numbers", () => {
    const cloud = generateSpiralCloud(300);
    for (let i = 0; i < cloud.length; i++) {
      expect(Number.isFinite(cloud[i])).toBe(true);
    }
  });

  it("stays inside a plausible spiral bounding box", () => {
    const cloud = generateSpiralCloud(900);
    for (let i = 0; i < cloud.length; i += 3) {
      expect(Math.abs(cloud[i])).toBeLessThan(5);
      expect(Math.abs(cloud[i + 1])).toBeLessThan(3);
      expect(cloud[i + 2]).toBeGreaterThan(-7);
      expect(cloud[i + 2]).toBeLessThan(5);
    }
  });
});

describe("generateProjectGrid", () => {
  it("returns a Float32Array of length count * 3", () => {
    const grid = generateProjectGrid(900);
    expect(grid).toBeInstanceOf(Float32Array);
    expect(grid.length).toBe(2700);
  });

  it("produces only finite numbers", () => {
    const grid = generateProjectGrid(300);
    for (let i = 0; i < grid.length; i++) {
      expect(Number.isFinite(grid[i])).toBe(true);
    }
  });

  it("fits within the declared grid bounds", () => {
    const grid = generateProjectGrid(900);
    const halfW = PROJECT_GRID_TOTAL_WIDTH / 2;
    const halfH = PROJECT_GRID_TOTAL_HEIGHT / 2;
    for (let i = 0; i < grid.length; i += 3) {
      expect(grid[i]).toBeGreaterThanOrEqual(-halfW - 0.001);
      expect(grid[i]).toBeLessThanOrEqual(halfW + 0.001);
      expect(grid[i + 1]).toBeGreaterThanOrEqual(-halfH - 0.001);
      expect(grid[i + 1]).toBeLessThanOrEqual(halfH + 0.001);
    }
  });

  it("spreads particles across the full width and height", () => {
    const grid = generateProjectGrid(900);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < grid.length; i += 3) {
      if (grid[i] < minX) minX = grid[i];
      if (grid[i] > maxX) maxX = grid[i];
      if (grid[i + 1] < minY) minY = grid[i + 1];
      if (grid[i + 1] > maxY) maxY = grid[i + 1];
    }
    expect(maxX - minX).toBeGreaterThan(PROJECT_GRID_TOTAL_WIDTH * 0.85);
    expect(maxY - minY).toBeGreaterThan(PROJECT_GRID_TOTAL_HEIGHT * 0.85);
  });
});
