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
