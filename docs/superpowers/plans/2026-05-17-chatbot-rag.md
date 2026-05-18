# Chatbot RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o chatbot responda usando o conteúdo completo dos posts do blog via RAG com busca vetorial, mantendo fallback gracioso para o comportamento atual quando RAG falhar.

**Architecture:** Always-in short index (já existente) + top-K chunks vetoriais recuperados on-demand. Embeddings via Gemini `text-embedding-004` (768 dims). Vector store em JSON no Netlify Blobs (`embeddings/posts-index.json`). Cosine similarity em memória. Indexação acoplada a `/api/blog/revalidate`. Fachada `_lib/rag.ts` desacopla callers de `chat.ts` e `blog-revalidate.ts` da implementação interna (embeddings/chunker/store).

**Tech Stack:** TypeScript, Netlify Functions, `@google/generative-ai` (already), `@netlify/blobs` (already), vitest.

**Spec:** `docs/superpowers/specs/2026-05-17-chatbot-rag-design.md`

---

## File Structure

### Novos
- `netlify/functions/_lib/chunker.ts` — quebra markdown em chunks com overlap (puro, sem I/O)
- `netlify/functions/_lib/embeddings.ts` — wrapper sobre Gemini text-embedding-004
- `netlify/functions/_lib/vector-store.ts` — CRUD sobre `embeddings/posts-index.json` no Blobs + cosine
- `netlify/functions/_lib/rag.ts` — fachada: `indexPost`, `retrieveRelevantChunks`
- `netlify/functions/blog-reindex.ts` — endpoint admin protegido (POST = reindex tudo)
- `netlify/functions/_lib/__tests__/chunker.test.ts`
- `netlify/functions/_lib/__tests__/embeddings.test.ts`
- `netlify/functions/_lib/__tests__/vector-store.test.ts`
- `netlify/functions/_lib/__tests__/rag.test.ts`

### Modificados
- `netlify/functions/blog-revalidate.ts` — após bust de cache, chamar `indexPost`
- `netlify/functions/chat.ts` — após `getPostsForPrompt`, chamar `retrieveRelevantChunks` com timeout
- `netlify.toml` — redirect `/api/blog/reindex`
- `docs/blog-setup.md` — nova seção "RAG no chatbot"

---

## Task 1: Chunker (puro, sem I/O)

**Files:**
- Create: `netlify/functions/_lib/chunker.ts`
- Test: `netlify/functions/_lib/__tests__/chunker.test.ts`

**Interface:**
```ts
export interface Chunk {
  idx: number;
  text: string;
  headingPath: string; // e.g. "## Stack > ### Drive"
}

export interface ChunkOptions {
  targetTokens?: number; // default 500
  overlap?: number;      // default 80
}

export function chunk(body: string, options?: ChunkOptions): Chunk[];
export function estimateTokens(text: string): number; // exposto pra teste
```

**Token estimation:** `ceil(chars / 4)` (heurística industry-standard, erro ±20% aceitável). Não há tokenizer oficial exposto pelo Google para embeddings.

- [ ] **Step 1: Write the failing tests**

Create `netlify/functions/_lib/__tests__/chunker.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { chunk, estimateTokens } from "../chunker";

describe("estimateTokens", () => {
  it("approximates 4 chars per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(2000))).toBe(500);
  });
});

describe("chunk", () => {
  it("returns empty array for empty body", () => {
    expect(chunk("")).toEqual([]);
    expect(chunk("   \n\n  ")).toEqual([]);
  });

  it("returns single chunk when body is small", () => {
    const body = "Curto e doce.\n\nApenas dois parágrafos.";
    const result = chunk(body, { targetTokens: 500, overlap: 80 });
    expect(result).toHaveLength(1);
    expect(result[0].idx).toBe(0);
    expect(result[0].text).toContain("Curto e doce");
    expect(result[0].text).toContain("dois parágrafos");
    expect(result[0].headingPath).toBe("");
  });

  it("splits long body into multiple chunks with overlap", () => {
    const para = "Lorem ipsum ".repeat(50) + ".";
    const body = Array.from({ length: 8 }, () => para).join("\n\n");
    const result = chunk(body, { targetTokens: 500, overlap: 80 });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].idx).toBe(0);
    expect(result[1].idx).toBe(1);
    // Overlap: some tail of chunk[0] should appear inside chunk[1].
    // Use a fingerprint of the last words of chunk[0].
    const lastWords = result[0].text.split(/\s+/).slice(-5).join(" ");
    expect(result[1].text).toContain(lastWords);
  });

  it("preserves heading path in chunks", () => {
    const body = `# Top

## Seção A

Texto da A.

### Subseção A1

Texto da A1.

## Seção B

Texto da B.`;
    const result = chunk(body, { targetTokens: 500, overlap: 80 });
    expect(result).toHaveLength(1); // small enough to fit
    expect(result[0].text).toContain("## Seção A");
  });

  it("attaches headingPath to chunks inside a section", () => {
    const longText = "palavra ".repeat(200);
    const body = `# Top

## Seção A

${longText}

### Subseção A1

${longText}

## Seção B

${longText}`;
    const result = chunk(body, { targetTokens: 200, overlap: 40 });
    expect(result.length).toBeGreaterThan(1);
    // At least one chunk should have a non-empty headingPath
    expect(result.some((c) => c.headingPath.includes("Seção"))).toBe(true);
  });

  it("does not split inside fenced code blocks", () => {
    const code = "```\n" + "linha ".repeat(100) + "\n```";
    const body = `Antes.\n\n${code}\n\nDepois.`;
    const result = chunk(body, { targetTokens: 100, overlap: 20 });
    // Each chunk that contains "```" should contain a matching closing "```"
    for (const c of result) {
      const opens = (c.text.match(/```/g) || []).length;
      expect(opens % 2).toBe(0);
    }
  });

  it("assigns sequential idx starting at 0", () => {
    const body = "Lorem ".repeat(2000);
    const result = chunk(body, { targetTokens: 200, overlap: 40 });
    result.forEach((c, i) => expect(c.idx).toBe(i));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/chunker.test.ts`
Expected: FAIL with "Cannot find module '../chunker'"

- [ ] **Step 3: Implement the chunker**

Create `netlify/functions/_lib/chunker.ts`:

```ts
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
  isFenceMarker?: boolean;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/chunker.test.ts`
Expected: PASS, all 7 tests green.

If any test fails, debug the chunker logic. Common pitfalls: fence handling off-by-one, heading stack not popping siblings correctly, overlap producing empty trailing chunk.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/chunker.ts netlify/functions/_lib/__tests__/chunker.test.ts
git commit -m "feat(rag): add markdown chunker with heading-aware overlap"
```

---

## Task 2: Embeddings wrapper

**Files:**
- Create: `netlify/functions/_lib/embeddings.ts`
- Test: `netlify/functions/_lib/__tests__/embeddings.test.ts`

**Interface:**
```ts
export const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIM = 768;

export async function embedText(text: string): Promise<number[]>;
export async function embedBatch(texts: string[]): Promise<number[][]>;
```

**Behavior:** uses `GEMINI_API_KEY` from env. `embedBatch` chunks arrays larger than 100 (hard cap). Single retry on 429/503 after 500ms.

- [ ] **Step 1: Write the failing tests**

Create `netlify/functions/_lib/__tests__/embeddings.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK at module level
const embedContentMock = vi.fn();
const batchEmbedContentsMock = vi.fn();

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn(() => ({
        embedContent: embedContentMock,
        batchEmbedContents: batchEmbedContentsMock,
      })),
    })),
  };
});

beforeEach(() => {
  embedContentMock.mockReset();
  batchEmbedContentsMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("embedText", () => {
  it("returns a 768-dim vector", async () => {
    const { embedText, EMBEDDING_DIM } = await import("../embeddings");
    embedContentMock.mockResolvedValue({
      embedding: { values: Array(EMBEDDING_DIM).fill(0.1) },
    });
    const vec = await embedText("hello");
    expect(vec).toHaveLength(EMBEDDING_DIM);
    expect(embedContentMock).toHaveBeenCalledOnce();
  });

  it("throws when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.resetModules();
    const { embedText } = await import("../embeddings");
    await expect(embedText("hi")).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("retries once on 429", async () => {
    const { embedText, EMBEDDING_DIM } = await import("../embeddings");
    embedContentMock
      .mockRejectedValueOnce(Object.assign(new Error("429 Too Many"), { status: 429 }))
      .mockResolvedValueOnce({ embedding: { values: Array(EMBEDDING_DIM).fill(0.2) } });
    const vec = await embedText("retry me");
    expect(vec).toHaveLength(EMBEDDING_DIM);
    expect(embedContentMock).toHaveBeenCalledTimes(2);
  });
});

describe("embedBatch", () => {
  it("returns N vectors for N inputs", async () => {
    const { embedBatch, EMBEDDING_DIM } = await import("../embeddings");
    batchEmbedContentsMock.mockResolvedValue({
      embeddings: [
        { values: Array(EMBEDDING_DIM).fill(0.1) },
        { values: Array(EMBEDDING_DIM).fill(0.2) },
        { values: Array(EMBEDDING_DIM).fill(0.3) },
      ],
    });
    const vecs = await embedBatch(["a", "b", "c"]);
    expect(vecs).toHaveLength(3);
    expect(vecs[0]).toHaveLength(EMBEDDING_DIM);
  });

  it("returns empty array for empty input", async () => {
    const { embedBatch } = await import("../embeddings");
    expect(await embedBatch([])).toEqual([]);
    expect(batchEmbedContentsMock).not.toHaveBeenCalled();
  });

  it("rejects batches larger than 100", async () => {
    const { embedBatch } = await import("../embeddings");
    const big = Array(101).fill("x");
    await expect(embedBatch(big)).rejects.toThrow(/batch.*100/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/embeddings.test.ts`
Expected: FAIL with "Cannot find module '../embeddings'"

- [ ] **Step 3: Implement embeddings.ts**

Create `netlify/functions/_lib/embeddings.ts`:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIM = 768;
const MAX_BATCH = 100;

let cachedClient: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status === 429 || status === 503) return true;
  const msg = (err as { message?: string }).message ?? "";
  return /429|503|rate|quota|unavailable/i.test(msg);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function embedText(text: string): Promise<number[]> {
  const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    if (!isRetryable(err)) throw err;
    await sleep(500);
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > MAX_BATCH) {
    throw new Error(`embedBatch: input size ${texts.length} exceeds MAX_BATCH=${MAX_BATCH}`);
  }
  const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
  const requests = texts.map((t) => ({ content: { role: "user", parts: [{ text: t }] } }));
  try {
    const result = await model.batchEmbedContents({ requests });
    return result.embeddings.map((e) => e.values);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    await sleep(500);
    const result = await model.batchEmbedContents({ requests });
    return result.embeddings.map((e) => e.values);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/embeddings.test.ts`
Expected: PASS, all 6 tests green.

If the "throws when GEMINI_API_KEY is missing" test fails because `cachedClient` was already set, ensure the test uses `vi.resetModules()` before re-import (already in the test). If still failing, also export a `__resetClientForTests` helper used only in tests — but only if needed.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/embeddings.ts netlify/functions/_lib/__tests__/embeddings.test.ts
git commit -m "feat(rag): add Gemini text-embedding-004 wrapper with single retry"
```

---

## Task 3: Vector store (Blobs + cosine)

**Files:**
- Create: `netlify/functions/_lib/vector-store.ts`
- Test: `netlify/functions/_lib/__tests__/vector-store.test.ts`

**Interface:**
```ts
export interface StoredChunk {
  slug: string;
  chunkIdx: number;
  text: string;
  headingPath: string;
  sourceTitle: string;
  vector: number[];
}

export interface SearchOptions {
  k?: number;          // default 5
  threshold?: number;  // default 0.6 cosine
  maxPerPost?: number; // default 2
}

export interface Hit {
  slug: string;
  text: string;
  headingPath: string;
  sourceTitle: string;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number;
export async function loadIndex(): Promise<{ chunks: StoredChunk[] }>;
export async function replacePostChunks(slug: string, chunks: StoredChunk[]): Promise<void>;
export async function removePost(slug: string): Promise<void>;
export async function searchSimilar(queryVec: number[], opts?: SearchOptions): Promise<Hit[]>;
export function __resetCacheForTests(): void;
```

**Storage:** Single JSON file `embeddings/posts-index.json` in store `blog`. Companion `embeddings/meta.json` holds `{ lastIndexedAt, modelVersion, dimension }`.

- [ ] **Step 1: Write the failing tests**

Create `netlify/functions/_lib/__tests__/vector-store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory Blobs mock
const blobStore = new Map<string, unknown>();
const getMock = vi.fn();
const setJSONMock = vi.fn();
const deleteMock = vi.fn();
const listMock = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: getMock,
    setJSON: setJSONMock,
    delete: deleteMock,
    list: listMock,
    set: vi.fn(),
  })),
}));

beforeEach(async () => {
  blobStore.clear();
  getMock.mockReset();
  setJSONMock.mockReset();
  deleteMock.mockReset();
  listMock.mockReset();
  getMock.mockImplementation(async (key: string) => blobStore.get(key) ?? null);
  setJSONMock.mockImplementation(async (key: string, value: unknown) => {
    blobStore.set(key, value);
  });
  deleteMock.mockImplementation(async (key: string) => {
    blobStore.delete(key);
  });
  const mod = await import("../vector-store");
  mod.__resetCacheForTests();
});

const v = (dim: number, fillIndex: number): number[] => {
  const arr = new Array(dim).fill(0);
  arr[fillIndex] = 1;
  return arr;
};

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", async () => {
    const { cosineSimilarity } = await import("../vector-store");
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });
  it("returns 0 for orthogonal vectors", async () => {
    const { cosineSimilarity } = await import("../vector-store");
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it("returns -1 for opposite vectors", async () => {
    const { cosineSimilarity } = await import("../vector-store");
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });
});

describe("loadIndex", () => {
  it("returns empty chunks when blob missing", async () => {
    const { loadIndex } = await import("../vector-store");
    const idx = await loadIndex();
    expect(idx.chunks).toEqual([]);
  });

  it("caches in memory after first load", async () => {
    const { loadIndex } = await import("../vector-store");
    blobStore.set("embeddings/posts-index.json", { chunks: [{ slug: "a", chunkIdx: 0, text: "x", headingPath: "", sourceTitle: "A", vector: [1, 0] }] });
    await loadIndex();
    await loadIndex();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("returns empty when JSON is corrupt", async () => {
    const { loadIndex } = await import("../vector-store");
    getMock.mockResolvedValue("not json");
    const idx = await loadIndex();
    expect(idx.chunks).toEqual([]);
  });
});

describe("replacePostChunks / removePost", () => {
  it("inserts chunks for a new slug", async () => {
    const { replacePostChunks, loadIndex } = await import("../vector-store");
    await replacePostChunks("hello", [
      { slug: "hello", chunkIdx: 0, text: "t1", headingPath: "", sourceTitle: "Hello", vector: v(8, 0) },
      { slug: "hello", chunkIdx: 1, text: "t2", headingPath: "", sourceTitle: "Hello", vector: v(8, 1) },
    ]);
    const idx = await loadIndex();
    expect(idx.chunks).toHaveLength(2);
  });

  it("replaces existing chunks of the same slug", async () => {
    const { replacePostChunks, loadIndex } = await import("../vector-store");
    await replacePostChunks("hello", [
      { slug: "hello", chunkIdx: 0, text: "old", headingPath: "", sourceTitle: "Hello", vector: v(8, 0) },
    ]);
    await replacePostChunks("hello", [
      { slug: "hello", chunkIdx: 0, text: "new", headingPath: "", sourceTitle: "Hello", vector: v(8, 1) },
    ]);
    const idx = await loadIndex();
    expect(idx.chunks).toHaveLength(1);
    expect(idx.chunks[0].text).toBe("new");
  });

  it("does not touch chunks of other slugs", async () => {
    const { replacePostChunks, loadIndex } = await import("../vector-store");
    await replacePostChunks("a", [{ slug: "a", chunkIdx: 0, text: "ta", headingPath: "", sourceTitle: "A", vector: v(8, 0) }]);
    await replacePostChunks("b", [{ slug: "b", chunkIdx: 0, text: "tb", headingPath: "", sourceTitle: "B", vector: v(8, 1) }]);
    const idx = await loadIndex();
    expect(idx.chunks.map((c) => c.slug).sort()).toEqual(["a", "b"]);
  });

  it("removePost removes only specified slug", async () => {
    const { replacePostChunks, removePost, loadIndex } = await import("../vector-store");
    await replacePostChunks("a", [{ slug: "a", chunkIdx: 0, text: "ta", headingPath: "", sourceTitle: "A", vector: v(8, 0) }]);
    await replacePostChunks("b", [{ slug: "b", chunkIdx: 0, text: "tb", headingPath: "", sourceTitle: "B", vector: v(8, 1) }]);
    await removePost("a");
    const idx = await loadIndex();
    expect(idx.chunks.map((c) => c.slug)).toEqual(["b"]);
  });
});

describe("searchSimilar", () => {
  it("returns hits ordered by score desc", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "x", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 1, text: "y", headingPath: "", sourceTitle: "A", vector: v(8, 1) },
    ]);
    const hits = await searchSimilar(v(8, 1), { k: 5, threshold: 0, maxPerPost: 5 });
    expect(hits[0].text).toBe("y");
    expect(hits[0].score).toBeCloseTo(1, 6);
  });

  it("filters by threshold", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "x", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
    ]);
    const hits = await searchSimilar(v(8, 1), { k: 5, threshold: 0.5, maxPerPost: 5 });
    expect(hits).toEqual([]);
  });

  it("respects maxPerPost", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "x0", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 1, text: "x1", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 2, text: "x2", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
    ]);
    await replacePostChunks("b", [
      { slug: "b", chunkIdx: 0, text: "y0", headingPath: "", sourceTitle: "B", vector: v(8, 0) },
    ]);
    const hits = await searchSimilar(v(8, 0), { k: 5, threshold: 0, maxPerPost: 2 });
    expect(hits.filter((h) => h.slug === "a")).toHaveLength(2);
    expect(hits.filter((h) => h.slug === "b")).toHaveLength(1);
  });

  it("ignores chunks with mismatched vector dimension", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "ok", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 1, text: "bad", headingPath: "", sourceTitle: "A", vector: v(16, 0) },
    ]);
    const hits = await searchSimilar(v(8, 0), { k: 5, threshold: 0, maxPerPost: 5 });
    expect(hits.map((h) => h.text)).toEqual(["ok"]);
  });

  it("returns top-k at most", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      slug: `s${i}`,
      chunkIdx: 0,
      text: `t${i}`,
      headingPath: "",
      sourceTitle: `S${i}`,
      vector: v(8, 0),
    }));
    for (const c of chunks) await replacePostChunks(c.slug, [c]);
    const hits = await searchSimilar(v(8, 0), { k: 3, threshold: 0, maxPerPost: 5 });
    expect(hits).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/vector-store.test.ts`
Expected: FAIL with "Cannot find module '../vector-store'"

- [ ] **Step 3: Implement vector-store.ts**

Create `netlify/functions/_lib/vector-store.ts`:

```ts
import { getStore } from "@netlify/blobs";

const STORE_NAME = "blog";
const INDEX_KEY = "embeddings/posts-index.json";
const META_KEY = "embeddings/meta.json";

export interface StoredChunk {
  slug: string;
  chunkIdx: number;
  text: string;
  headingPath: string;
  sourceTitle: string;
  vector: number[];
}

export interface IndexFile {
  chunks: StoredChunk[];
}

export interface MetaFile {
  lastIndexedAt: number;
  modelVersion: string;
  dimension: number;
}

export interface SearchOptions {
  k?: number;
  threshold?: number;
  maxPerPost?: number;
}

export interface Hit {
  slug: string;
  text: string;
  headingPath: string;
  sourceTitle: string;
  score: number;
}

let memCache: IndexFile | null = null;

function safeStore() {
  try {
    return getStore(STORE_NAME);
  } catch (e) {
    if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return null;
    throw e;
  }
}

export function __resetCacheForTests(): void {
  memCache = null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function loadIndex(): Promise<IndexFile> {
  if (memCache) return memCache;
  const s = safeStore();
  if (!s) {
    memCache = { chunks: [] };
    return memCache;
  }
  let raw: unknown = null;
  try {
    raw = await s.get(INDEX_KEY, { type: "json" });
  } catch (err) {
    console.error("vector-store.loadIndex: blob read failed", err);
    return { chunks: [] }; // do NOT cache on failure (avoid poisoning)
  }
  if (!raw || typeof raw !== "object") {
    memCache = { chunks: [] };
    return memCache;
  }
  const candidate = raw as IndexFile;
  if (!Array.isArray(candidate.chunks)) {
    console.error("vector-store.loadIndex: malformed index, ignoring");
    memCache = { chunks: [] };
    return memCache;
  }
  memCache = candidate;
  return memCache;
}

async function saveIndex(index: IndexFile, meta: Partial<MetaFile> = {}): Promise<void> {
  const s = safeStore();
  if (!s) return;
  await s.setJSON(INDEX_KEY, index);
  const fullMeta: MetaFile = {
    lastIndexedAt: Date.now(),
    modelVersion: meta.modelVersion ?? "text-embedding-004",
    dimension: meta.dimension ?? (index.chunks[0]?.vector.length ?? 768),
  };
  await s.setJSON(META_KEY, fullMeta);
  memCache = index;
}

export async function replacePostChunks(slug: string, chunks: StoredChunk[]): Promise<void> {
  const idx = await loadIndex();
  const others = idx.chunks.filter((c) => c.slug !== slug);
  const next: IndexFile = { chunks: [...others, ...chunks] };
  await saveIndex(next);
}

export async function removePost(slug: string): Promise<void> {
  const idx = await loadIndex();
  const next: IndexFile = { chunks: idx.chunks.filter((c) => c.slug !== slug) };
  await saveIndex(next);
}

export async function searchSimilar(queryVec: number[], opts: SearchOptions = {}): Promise<Hit[]> {
  const k = opts.k ?? 5;
  const threshold = opts.threshold ?? 0.6;
  const maxPerPost = opts.maxPerPost ?? 2;
  const idx = await loadIndex();
  if (idx.chunks.length === 0) return [];
  const scored = idx.chunks
    .filter((c) => c.vector.length === queryVec.length)
    .map((c) => ({
      slug: c.slug,
      text: c.text,
      headingPath: c.headingPath,
      sourceTitle: c.sourceTitle,
      score: cosineSimilarity(queryVec, c.vector),
    }))
    .filter((h) => h.score >= threshold)
    .sort((a, b) => b.score - a.score);
  const perPost = new Map<string, number>();
  const out: Hit[] = [];
  for (const hit of scored) {
    if (out.length >= k) break;
    const count = perPost.get(hit.slug) ?? 0;
    if (count >= maxPerPost) continue;
    perPost.set(hit.slug, count + 1);
    out.push(hit);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/vector-store.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/vector-store.ts netlify/functions/_lib/__tests__/vector-store.test.ts
git commit -m "feat(rag): add vector store backed by Netlify Blobs with cosine search"
```

---

## Task 4: RAG facade

**Files:**
- Create: `netlify/functions/_lib/rag.ts`
- Test: `netlify/functions/_lib/__tests__/rag.test.ts`

**Interface:**
```ts
export async function indexPost(slug: string, body: string, sourceTitle: string): Promise<{ chunks: number }>;
export async function retrieveRelevantChunks(query: string): Promise<string>;
```

**Behavior:**
- `indexPost`: chunks → batch embed → replace in store. Empty body → calls `removePost`.
- `retrieveRelevantChunks`: embed query → search → format with header. Returns `""` on any failure (no throw) or when 0 hits.

- [ ] **Step 1: Write the failing tests**

Create `netlify/functions/_lib/__tests__/rag.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const embedTextMock = vi.fn();
const embedBatchMock = vi.fn();
vi.mock("../embeddings", () => ({
  EMBEDDING_DIM: 8,
  EMBEDDING_MODEL: "text-embedding-004",
  embedText: embedTextMock,
  embedBatch: embedBatchMock,
}));

const replacePostChunksMock = vi.fn();
const removePostMock = vi.fn();
const searchSimilarMock = vi.fn();
vi.mock("../vector-store", () => ({
  replacePostChunks: replacePostChunksMock,
  removePost: removePostMock,
  searchSimilar: searchSimilarMock,
}));

beforeEach(() => {
  embedTextMock.mockReset();
  embedBatchMock.mockReset();
  replacePostChunksMock.mockReset();
  removePostMock.mockReset();
  searchSimilarMock.mockReset();
});

describe("indexPost", () => {
  it("chunks, embeds, and stores", async () => {
    const { indexPost } = await import("../rag");
    // Return one 8-dim vector per input text (matches chunker output length)
    embedBatchMock.mockImplementation(async (texts: string[]) =>
      texts.map(() => new Array(8).fill(0.1)),
    );
    const longBody = "parágrafo um.\n\n" + "Lorem ipsum dolor sit amet. ".repeat(200);
    const result = await indexPost("hello", longBody, "Hello World");
    expect(result.chunks).toBeGreaterThan(0);
    expect(embedBatchMock).toHaveBeenCalledOnce();
    expect(replacePostChunksMock).toHaveBeenCalledWith(
      "hello",
      expect.arrayContaining([
        expect.objectContaining({ slug: "hello", sourceTitle: "Hello World" }),
      ]),
    );
  });

  it("calls removePost when body is empty", async () => {
    const { indexPost } = await import("../rag");
    const result = await indexPost("empty", "", "Empty");
    expect(result.chunks).toBe(0);
    expect(removePostMock).toHaveBeenCalledWith("empty");
    expect(replacePostChunksMock).not.toHaveBeenCalled();
    expect(embedBatchMock).not.toHaveBeenCalled();
  });
});

describe("retrieveRelevantChunks", () => {
  it("formats hits with header and separators", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockResolvedValue(new Array(8).fill(0.1));
    searchSimilarMock.mockResolvedValue([
      { slug: "a", text: "Trecho A.", headingPath: "## Sec A", sourceTitle: "Post A", score: 0.9 },
      { slug: "b", text: "Trecho B.", headingPath: "## Sec B", sourceTitle: "Post B", score: 0.8 },
    ]);
    const out = await retrieveRelevantChunks("pergunta");
    expect(out).toContain("TRECHOS RELEVANTES DO BLOG");
    expect(out).toContain("[Post A — ## Sec A] (/blog/a)");
    expect(out).toContain("Trecho A.");
    expect(out).toContain("[Post B — ## Sec B] (/blog/b)");
    expect(out).toContain("Trecho B.");
  });

  it("returns empty string when no hits", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockResolvedValue(new Array(8).fill(0.1));
    searchSimilarMock.mockResolvedValue([]);
    expect(await retrieveRelevantChunks("nada")).toBe("");
  });

  it("returns empty string and does not throw when embedText fails", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockRejectedValue(new Error("api down"));
    expect(await retrieveRelevantChunks("x")).toBe("");
  });

  it("returns empty string and does not throw when searchSimilar fails", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockResolvedValue(new Array(8).fill(0.1));
    searchSimilarMock.mockRejectedValue(new Error("store down"));
    expect(await retrieveRelevantChunks("x")).toBe("");
  });

  it("returns empty string when query is blank", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    expect(await retrieveRelevantChunks("")).toBe("");
    expect(await retrieveRelevantChunks("   ")).toBe("");
    expect(embedTextMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/rag.test.ts`
Expected: FAIL with "Cannot find module '../rag'"

- [ ] **Step 3: Implement rag.ts**

Create `netlify/functions/_lib/rag.ts`:

```ts
import { chunk as chunkMarkdown } from "./chunker";
import { embedBatch, embedText } from "./embeddings";
import {
  removePost,
  replacePostChunks,
  searchSimilar,
  type StoredChunk,
} from "./vector-store";

const RAG_HEADER = "\n\n---\n\nTRECHOS RELEVANTES DO BLOG (use quando responder):\n\n";
const RAG_SEPARATOR = "\n---\n";
const TOP_K = 5;
const THRESHOLD = 0.6;
const MAX_PER_POST = 2;

export async function indexPost(
  slug: string,
  body: string,
  sourceTitle: string,
): Promise<{ chunks: number }> {
  const start = Date.now();
  const trimmed = (body ?? "").trim();
  if (!trimmed) {
    await removePost(slug);
    return { chunks: 0 };
  }
  const pieces = chunkMarkdown(trimmed);
  if (pieces.length === 0) {
    await removePost(slug);
    return { chunks: 0 };
  }
  if (pieces.length > 50) {
    console.warn(`rag.indexPost: slug=${slug} unusually large (${pieces.length} chunks)`);
  }
  const vectors = await embedBatch(pieces.map((p) => p.text));
  const stored: StoredChunk[] = pieces.map((p, i) => ({
    slug,
    chunkIdx: p.idx,
    text: p.text,
    headingPath: p.headingPath,
    sourceTitle,
    vector: vectors[i],
  }));
  await replacePostChunks(slug, stored);
  console.log(`rag.indexPost: slug=${slug} chunks=${stored.length} elapsedMs=${Date.now() - start}`);
  return { chunks: stored.length };
}

export async function retrieveRelevantChunks(query: string): Promise<string> {
  const start = Date.now();
  const trimmed = (query ?? "").trim();
  if (!trimmed) return "";
  let queryVec: number[];
  try {
    queryVec = await embedText(trimmed);
  } catch (err) {
    console.error("rag.retrieveRelevantChunks: degraded reason=embeddings_failed", err);
    return "";
  }
  let hits;
  try {
    hits = await searchSimilar(queryVec, { k: TOP_K, threshold: THRESHOLD, maxPerPost: MAX_PER_POST });
  } catch (err) {
    console.error("rag.retrieveRelevantChunks: degraded reason=store_failed", err);
    return "";
  }
  if (hits.length === 0) {
    console.log(`rag.retrieveRelevantChunks: hits=0 elapsedMs=${Date.now() - start}`);
    return "";
  }
  const body = hits
    .map((h) => `[${h.sourceTitle} — ${h.headingPath}] (/blog/${h.slug})\n${h.text}`)
    .join(RAG_SEPARATOR);
  console.log(
    `rag.retrieveRelevantChunks: hits=${hits.length} topScore=${hits[0].score.toFixed(2)} elapsedMs=${Date.now() - start}`,
  );
  return RAG_HEADER + body + "\n";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- netlify/functions/_lib/__tests__/rag.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite to make sure nothing else broke**

Run: `npm run test:run`
Expected: PASS, all suites green.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/rag.ts netlify/functions/_lib/__tests__/rag.test.ts
git commit -m "feat(rag): add facade orchestrating chunker, embeddings, and vector store"
```

---

## Task 5: blog-reindex endpoint

**Files:**
- Create: `netlify/functions/blog-reindex.ts`
- Modify: `netlify.toml` (add redirect)

**No new tests** — this is an admin endpoint covered by smoke test in Task 9.

- [ ] **Step 1: Create the endpoint**

Create `netlify/functions/blog-reindex.ts`:

```ts
import type { Handler } from "@netlify/functions";
import { listFolder, downloadText, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { parsePost } from "../../src/lib/blog/frontmatter";
import { indexPost } from "./_lib/rag";

interface ReindexError {
  slug: string;
  error: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const expectedToken = process.env.BLOG_REVALIDATE_TOKEN;
  if (!expectedToken) {
    return { statusCode: 500, body: "BLOG_REVALIDATE_TOKEN not configured" };
  }
  const provided =
    event.headers["x-revalidate-token"] || event.headers["X-Revalidate-Token"];
  if (provided !== expectedToken) {
    return { statusCode: 401, body: "Invalid or missing token" };
  }

  let files: DriveFile[];
  try {
    const folders = await resolveBlogFolders();
    files = await listFolder(folders.rootId);
  } catch (err) {
    console.error("blog-reindex: drive list failed", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "drive list failed" }),
    };
  }

  const mdFiles = files.filter((f) => {
    if (!f.name.endsWith(".md")) return false;
    if (f.mimeType.startsWith("application/vnd.google-apps.")) {
      console.warn(`blog-reindex: skipping "${f.name}" (mimeType=${f.mimeType})`);
      return false;
    }
    return true;
  });

  const errors: ReindexError[] = [];
  let indexed = 0;
  for (const f of mdFiles) {
    try {
      const raw = await downloadText(f.id);
      const { meta, body } = parsePost(raw, f.name);
      if (meta.draft) continue;
      await indexPost(meta.slug, body, meta.title);
      indexed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`blog-reindex: failed slug=${f.name}`, err);
      errors.push({ slug: f.name, error: msg });
    }
  }

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      total: mdFiles.length,
      indexed,
      failed: errors.length,
      errors,
    }),
  };
};
```

- [ ] **Step 2: Add the redirect in netlify.toml**

Edit `netlify.toml`. Find the block:

```toml
[[redirects]]
  from = "/api/blog/revalidate"
  to = "/.netlify/functions/blog-revalidate"
  status = 200
```

Add immediately after it:

```toml
[[redirects]]
  from = "/api/blog/reindex"
  to = "/.netlify/functions/blog-reindex"
  status = 200
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: PASS without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-reindex.ts netlify.toml
git commit -m "feat(rag): add /api/blog/reindex admin endpoint for full reindex"
```

---

## Task 6: Wire indexing into blog-revalidate.ts

**Files:**
- Modify: `netlify/functions/blog-revalidate.ts`

Approach: after the existing cache delete, fetch the post from Drive (reusing the same scan pattern as `blog-post.ts`), parse it, and call `indexPost`. If the slug is not found (post deleted), call `removePost`. On `?all=true`, perform a full reindex inline (small Ns; for large Ns the admin should use `/api/blog/reindex`).

- [ ] **Step 1: Replace blog-revalidate.ts entirely**

Overwrite `netlify/functions/blog-revalidate.ts`:

```ts
import type { Handler } from "@netlify/functions";
import { deleteCached, deleteByPrefix } from "./_lib/blob-cache";
import { listFolder, downloadText, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { parsePost } from "../../src/lib/blog/frontmatter";
import { indexPost, removePost as ragRemovePost } from "./_lib/rag";

async function listMdFiles(): Promise<DriveFile[]> {
  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  return files.filter((f) => {
    if (!f.name.endsWith(".md")) return false;
    if (f.mimeType.startsWith("application/vnd.google-apps.")) return false;
    return true;
  });
}

async function reindexSlug(slug: string): Promise<
  | { indexed: true; chunks: number }
  | { indexed: false; removed: true }
  | { indexed: false; error: string }
> {
  const mdFiles = await listMdFiles();
  for (const f of mdFiles) {
    const raw = await downloadText(f.id);
    const { meta, body } = parsePost(raw, f.name);
    if (meta.slug !== slug) continue;
    if (meta.draft) {
      await ragRemovePost(slug);
      return { indexed: false, removed: true };
    }
    const { chunks } = await indexPost(slug, body, meta.title);
    return { indexed: true, chunks };
  }
  // Slug not found in Drive — treat as deletion
  await ragRemovePost(slug);
  return { indexed: false, removed: true };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const expectedToken = process.env.BLOG_REVALIDATE_TOKEN;
  if (!expectedToken) {
    return { statusCode: 500, body: "BLOG_REVALIDATE_TOKEN not configured" };
  }

  const provided =
    event.headers["x-revalidate-token"] || event.headers["X-Revalidate-Token"];
  if (provided !== expectedToken) {
    return { statusCode: 401, body: "Invalid or missing token" };
  }

  const url = new URL(event.rawUrl);
  const slug = url.searchParams.get("slug");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    await deleteByPrefix("posts/");
    // Full reindex inline (cheap for small Ns; for many posts use /api/blog/reindex)
    let indexed = 0;
    let failed = 0;
    try {
      const mdFiles = await listMdFiles();
      for (const f of mdFiles) {
        try {
          const raw = await downloadText(f.id);
          const { meta, body } = parsePost(raw, f.name);
          if (meta.draft) continue;
          await indexPost(meta.slug, body, meta.title);
          indexed += 1;
        } catch (err) {
          console.error(`blog-revalidate: reindex failed file=${f.name}`, err);
          failed += 1;
        }
      }
    } catch (err) {
      console.error("blog-revalidate: drive list failed in ?all=true", err);
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ cleared: "posts/*", reindexed: indexed, failed }),
    };
  }

  if (!slug) {
    return { statusCode: 400, body: "slug required (or pass ?all=true)" };
  }

  await deleteCached("posts/list");
  await deleteCached(`posts/${slug}`);
  await deleteCached("posts/prompt-summary"); // chatbot summary uses same source

  let ragResult: Awaited<ReturnType<typeof reindexSlug>> | { indexed: false; error: string };
  try {
    ragResult = await reindexSlug(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`blog-revalidate: rag reindex failed slug=${slug}`, err);
    ragResult = { indexed: false, error: msg };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      cleared: [`posts/list`, `posts/${slug}`, `posts/prompt-summary`],
      rag: ragResult,
    }),
  };
};
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run full test suite (no regressions)**

Run: `npm run test:run`
Expected: PASS, all suites still green.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-revalidate.ts
git commit -m "feat(rag): trigger indexPost from blog-revalidate; also clear posts/prompt-summary"
```

---

## Task 7: Wire retrieval into chat.ts

**Files:**
- Modify: `netlify/functions/chat.ts`

Add an import, a small `withTimeout` helper, and 4 lines inside the handler that build `ragContext` with timeout + try/catch, then concatenate to the system prompt. Apply to both `isSearchQuery` and default-mode branches.

- [ ] **Step 1: Add the rag import and helper at the top of chat.ts**

Edit `netlify/functions/chat.ts`. Find the existing imports block (lines 1-9). Add this import after the existing imports:

```ts
import { retrieveRelevantChunks } from "./_lib/rag";
```

Then, right above the `// ─── Blog Posts Helper ──...` divider (around line 45), add this helper:

```ts
const RAG_TIMEOUT_MS = 1500;

async function getRagContextSafe(message: string): Promise<string> {
  try {
    return await Promise.race([
      retrieveRelevantChunks(message),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), RAG_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.error("chat: rag retrieve threw unexpectedly", err);
    return "";
  }
}
```

- [ ] **Step 2: Use the helper to build the full system prompt**

In `chat.ts`, find this existing block (around line 492-493):

```ts
    const postsSummary = await getPostsForPrompt();
    const fullSystemPrompt = SYSTEM_PROMPT + postsSummary;
```

Replace it with:

```ts
    const postsSummary = await getPostsForPrompt();
    const ragContext = await getRagContextSafe(message);
    const fullSystemPrompt = SYSTEM_PROMPT + postsSummary + ragContext;
```

The rest of the handler (search-mode branch and default JSON-mode branch) already uses `fullSystemPrompt`, so both modes get RAG automatically.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/chat.ts
git commit -m "feat(rag): inject top-K relevant chunks into chat system prompt with 1.5s timeout"
```

---

## Task 8: Update docs/blog-setup.md

**Files:**
- Modify: `docs/blog-setup.md`

- [ ] **Step 1: Read the current end of the file**

Run: open `docs/blog-setup.md` and scroll to the end. We will append a new section after the existing content. Do NOT modify any existing sections.

- [ ] **Step 2: Append the new section**

Append this block at the end of `docs/blog-setup.md`:

```markdown

---

## RAG no chatbot

### O que é

O chatbot do site usa RAG (Retrieval-Augmented Generation) sobre os posts do blog. A cada mensagem, ele recupera os trechos mais relevantes dos posts e usa como contexto para responder. Isso permite respostas como "no post X, escrevi que Y..." com citação real do conteúdo — não só recomendação do link.

### Como funciona

Quando um post é publicado/atualizado e você bate em `/api/blog/revalidate?slug=foo`, o sistema também gera embeddings vetoriais do conteúdo (via Gemini `text-embedding-004`) e armazena num índice JSON no Netlify Blobs (`embeddings/posts-index.json`). Quando alguém manda mensagem no chat, a pergunta é convertida em vetor e os top-5 trechos mais similares (cosine ≥ 0.6, no máximo 2 por post) são injetados no prompt.

### Bootstrap inicial (rodar 1 vez após primeiro deploy)

```bash
curl -X POST https://guiresende20.netlify.app/api/blog/reindex \
  -H "X-Revalidate-Token: $BLOG_REVALIDATE_TOKEN"
```

Esperado: `200 { total: N, indexed: N, failed: 0 }`.

### Quando reindexar manualmente

- Após criar um post novo: acontece automático via `/api/blog/revalidate?slug=<novo>`.
- Após editar um post: idem.
- **Botão de pânico**: se as respostas começarem a ficar estranhas (ou após mudar configurações), rodar `POST /api/blog/reindex` para regenerar tudo.

### Custo

- Indexação: ~1 chamada de embedding por post (em batch). Free tier do Gemini cobre folgado (1500 req/dia).
- Consulta: 1 chamada de embedding por mensagem do chat. ~$0.000015 por pergunta — desprezível.
- Storage: ~5KB por post no Blobs. 100 posts = 500KB. Free tier.

### Como verificar se está funcionando

- No painel Blobs do Netlify: existem `embeddings/posts-index.json` e `embeddings/meta.json`.
- Pergunta de teste no chat: "o que você escreveu sobre [tópico de um post]?" — a resposta deve citar trecho específico, não apenas recomendar o link.
- Logs da function `chat` (painel Functions do Netlify): linha `rag.retrieveRelevantChunks: ... hits=N topScore=0.XX`.

### Troubleshooting

| Sintoma | Diagnóstico | Fix |
|---|---|---|
| Chatbot só recomenda links, nunca cita trechos | Índice vazio | `POST /api/blog/reindex` |
| Chatbot cita trechos errados pra perguntas off-topic | Threshold muito baixo | Subir `THRESHOLD` de 0.6 → 0.7 em `netlify/functions/_lib/rag.ts` |
| Latência do chat aumentou >800ms | Embedding API lenta | Verificar status do Gemini; threshold do timeout interno é 1.5s (degrada gracioso) |
| Erro `"vector store write failed"` no log | Blobs sem permissão / contexto | Verificar que a function roda em contexto Netlify (não local sem `netlify dev`) |
| 401 no `/api/blog/reindex` | Token errado ou ausente | Conferir env var `BLOG_REVALIDATE_TOKEN` e header `X-Revalidate-Token` |

### Limitações conhecidas

- Indexação é síncrona dentro do revalidate. Post muito longo (>50 chunks) pode levar 2-3s — aceitável pra blog pessoal.
- Drafts (`meta.draft === true`) e quaisquer posts em subpastas NÃO são indexados, por design.
- Cache em memória da function pode ficar até ~1min defasado após reindex (warm function pode segurar índice velho). Não é problema em prática.
```

- [ ] **Step 3: Commit**

```bash
git add docs/blog-setup.md
git commit -m "docs(rag): add owner-facing setup, troubleshooting, and limitations"
```

---

## Task 9: Bootstrap + smoke test in production

This task has **no code changes**. It validates the deployed system end-to-end. Execute only after Tasks 1-8 are merged to `main` and Netlify finishes deploying.

- [ ] **Step 1: Confirm deploy is live**

Open https://guiresende20.netlify.app/blog in a browser. Confirm the blog still loads (no regression in the public surface).

- [ ] **Step 2: Bootstrap the vector index**

Run in a terminal with `BLOG_REVALIDATE_TOKEN` set to the value stored in Netlify env vars:

```bash
curl -X POST https://guiresende20.netlify.app/api/blog/reindex \
  -H "X-Revalidate-Token: $BLOG_REVALIDATE_TOKEN"
```

Expected response (something like):

```json
{ "total": 1, "indexed": 1, "failed": 0, "errors": [] }
```

If `failed > 0`, inspect `errors[]` and the Netlify function logs for `blog-reindex`. Common causes: Drive permission, missing `GEMINI_API_KEY`, malformed post.

- [ ] **Step 3: Verify the index in Netlify Blobs**

In Netlify dashboard → site → Blobs → store `blog`. Confirm two new keys exist:
- `embeddings/posts-index.json` (sizable JSON, contains `chunks[]` with `vector: [...]`)
- `embeddings/meta.json` (`{ lastIndexedAt, modelVersion, dimension: 768 }`)

- [ ] **Step 4: Smoke test the 5 planted questions**

Open the chatbot on https://guiresende20.netlify.app. Ask, one at a time, and record what comes back:

| # | Pergunta | Expectativa |
|---|---|---|
| 1 | "Por que você fez o blog com Drive em vez de um CMS?" | Cita um trecho específico do post sobre o "porquê" |
| 2 | "Como funciona a tradução automática?" | Cita trecho sobre Gemini + cache |
| 3 | "Você tem post sobre VR?" | Diz que ainda não, ou recomenda adjacentes — NÃO inventa |
| 4 | "O que é o MuseuVR?" (info está no SYSTEM_PROMPT, não no blog) | Responde do SYSTEM_PROMPT; RAG não polui |
| 5 | "olá" | Saudação curta; RAG retornou `""` |

Acceptance: **4 of 5 match expectation**.

If 2-3 fail because RAG citations are weak/irrelevant: raise `THRESHOLD` in `_lib/rag.ts` from `0.6` → `0.7`, redeploy, re-run.

If 4-5 fail: open a follow-up to investigate chunking or model choice — do NOT consider the feature shipped.

- [ ] **Step 5: Measure latency**

In the Netlify Functions log for `chat`, find a `rag.retrieveRelevantChunks: hits=...` line. Confirm `elapsedMs` is under 400ms. If consistently >800ms, open a follow-up.

- [ ] **Step 6: Update the auto-memory project entry**

Append a line to the Phase 5 follow-ups in `memory/blog_implementation_in_progress.md` noting that the RAG follow-up is now SHIPPED, and capture any tuning decisions made during this smoke test.

- [ ] **Step 7: Final commit (only if any tuning changes were made)**

```bash
git add netlify/functions/_lib/rag.ts
git commit -m "chore(rag): tune threshold after prod smoke test"
```

---

## Definition of Done

- All 4 unit test suites (`chunker`, `embeddings`, `vector-store`, `rag`) green.
- `npm run build` passes.
- `npm run test:run` passes.
- `/api/blog/reindex` returns `200` with `indexed >= 1, failed == 0` on production.
- Netlify Blobs panel shows `embeddings/posts-index.json` and `embeddings/meta.json`.
- 4 of 5 smoke-test questions return the expected behavior.
- `docs/blog-setup.md` has the new "RAG no chatbot" section.
- Memory file updated to mark RAG follow-up as SHIPPED.
