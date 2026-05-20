export function hueFromProgress(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  return (0.4 + clamped) % 1;
}
