export function generateSpiralCloud(count: number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const band = i / count;
    const radius = 2.2 + Math.sin(i * 0.17) * 0.55 + Math.random() * 1.2;
    const angle = band * Math.PI * 8 + Math.random() * 0.35;
    const height = (Math.random() - 0.5) * 2.8;

    pos[i3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.35;
    pos[i3 + 1] = height + Math.sin(angle * 0.7) * 0.5;
    pos[i3 + 2] = Math.sin(angle) * radius - 1.4 + (Math.random() - 0.5) * 0.35;
  }
  return pos;
}

const GRID_COLS = 3;
const GRID_ROWS = 3;
const CARD_WIDTH = 1.4;
const CARD_HEIGHT = 0.9;
const CARD_GAP_X = 0.5;
const CARD_GAP_Y = 0.4;
const GRID_DEPTH = -1.4;
const GRID_DEPTH_JITTER = 0.08;

export const PROJECT_GRID_TOTAL_WIDTH =
  GRID_COLS * CARD_WIDTH + (GRID_COLS - 1) * CARD_GAP_X;
export const PROJECT_GRID_TOTAL_HEIGHT =
  GRID_ROWS * CARD_HEIGHT + (GRID_ROWS - 1) * CARD_GAP_Y;

export function generateProjectGrid(count: number): Float32Array {
  const pos = new Float32Array(count * 3);
  const cardCount = GRID_COLS * GRID_ROWS;
  const perCard = Math.ceil(count / cardCount);
  let idx = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cardX =
        -PROJECT_GRID_TOTAL_WIDTH / 2 +
        c * (CARD_WIDTH + CARD_GAP_X) +
        CARD_WIDTH / 2;
      const cardY =
        PROJECT_GRID_TOTAL_HEIGHT / 2 -
        r * (CARD_HEIGHT + CARD_GAP_Y) -
        CARD_HEIGHT / 2;

      for (let p = 0; p < perCard && idx < count; p++) {
        const i3 = idx * 3;
        pos[i3] = cardX + (Math.random() - 0.5) * CARD_WIDTH;
        pos[i3 + 1] = cardY + (Math.random() - 0.5) * CARD_HEIGHT;
        pos[i3 + 2] = GRID_DEPTH + (Math.random() - 0.5) * GRID_DEPTH_JITTER;
        idx++;
      }
    }
  }

  while (idx < count) {
    const i3 = idx * 3;
    pos[i3] = 0;
    pos[i3 + 1] = 0;
    pos[i3 + 2] = GRID_DEPTH;
    idx++;
  }

  return pos;
}
