// Quebra markdown em chunks com overlap, preservando o caminho de headings
// (ex.: "## Seção > ### Subseção") para dar contexto a cada trecho.
//
// Estratégia:
// 1. Tokenize linha-a-linha mantendo blocos fenceados (``` … ```) atômicos.
// 2. Agrupa parágrafos até atingir ~targetTokens.
// 3. Quando flush, registra headingPath corrente.
// 4. Gera overlap copiando os últimos ~overlap tokens do chunk anterior.

export interface Chunk {
  idx: number;
  text: string;
  headingPath: string;
}

export interface ChunkOptions {
  targetTokens?: number;
  overlap?: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function takeLastTokens(text: string, tokens: number): string {
  const chars = tokens * 4;
  return text.length <= chars ? text : text.slice(-chars);
}

interface Block {
  text: string;
  heading?: { level: number; title: string }; // se a linha for heading
}

function parseBlocks(body: string): Block[] {
  const lines = body.split(/\r?\n/);
  const blocks: Block[] = [];
  let inFence = false;
  let buffer: string[] = [];

  const flushBuffer = () => {
    const joined = buffer.join("\n").trim();
    if (joined) blocks.push({ text: joined });
    buffer = [];
  };

  for (const line of lines) {
    const fenceMatch = /^```/.test(line);
    if (fenceMatch) {
      buffer.push(line);
      if (inFence) {
        // closing fence: flush whole fenced block as one block
        flushBuffer();
        inFence = false;
      } else {
        // opening fence: flush whatever came before, then start fenced
        const opener = buffer.pop()!;
        flushBuffer();
        buffer.push(opener);
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      buffer.push(line);
      continue;
    }
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flushBuffer();
      blocks.push({
        text: line.trim(),
        heading: { level: headingMatch[1].length, title: headingMatch[2] },
      });
      continue;
    }
    if (line.trim() === "") {
      flushBuffer();
      continue;
    }
    buffer.push(line);
  }
  flushBuffer();
  return blocks;
}

function buildHeadingPath(stack: Array<{ level: number; title: string }>): string {
  return stack
    .map((h) => `${"#".repeat(h.level)} ${h.title}`)
    .join(" > ");
}

export function chunk(body: string, options: ChunkOptions = {}): Chunk[] {
  const targetTokens = options.targetTokens ?? 500;
  const overlap = options.overlap ?? 80;
  if (!body || !body.trim()) return [];

  const blocks = parseBlocks(body);
  const chunks: Chunk[] = [];
  const headingStack: Array<{ level: number; title: string }> = [];
  let current: string[] = [];
  let currentTokens = 0;
  let idx = 0;

  const flush = () => {
    if (current.length === 0) return;
    const text = current.join("\n\n").trim();
    if (!text) {
      current = [];
      currentTokens = 0;
      return;
    }
    chunks.push({
      idx: idx++,
      text,
      headingPath: buildHeadingPath(headingStack),
    });
    // Carry overlap to next chunk, but NOT when this chunk contains a code
    // fence — a partial tail could split the fence pair and create
    // unbalanced ``` markers in the next chunk.
    const hasFence = /```/.test(text);
    if (hasFence) {
      current = [];
      currentTokens = 0;
      return;
    }
    const tail = takeLastTokens(text, overlap);
    current = tail ? [tail] : [];
    currentTokens = estimateTokens(tail);
  };

  for (const block of blocks) {
    if (block.heading) {
      // pop stack to block.heading.level - 1, then push
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= block.heading.level
      ) {
        headingStack.pop();
      }
      headingStack.push(block.heading);
      // include the heading line itself in the chunk
      current.push(block.text);
      currentTokens += estimateTokens(block.text);
      continue;
    }
    const blockTokens = estimateTokens(block.text);
    if (currentTokens + blockTokens > targetTokens && currentTokens > 0) {
      flush();
    }
    current.push(block.text);
    currentTokens += blockTokens;
  }
  flush();
  // If overlap-only chunk was created at the end, drop it
  return chunks.filter((c) => c.text.trim().length > 0);
}
