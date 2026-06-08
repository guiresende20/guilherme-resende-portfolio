import { getStore } from "@netlify/blobs";

const STORE_NAME = "blog"; // reuse existing store; key prefix isolates the index
const INDEX_KEY = "embeddings/aerolito-index.json";

export interface AerolitoChunk {
  id: string;
  text: string;          // formato "P: <pergunta>\nR: <resposta>"
  vector: number[];
  questionIdx: number;
  createdAt: string;
}

export interface AerolitoIndexFile {
  chunks: AerolitoChunk[];
}

export interface AerolitoHit {
  id: string;
  text: string;
  questionIdx: number;
  score: number;
}

export interface AerolitoSearchOptions {
  k?: number;
  threshold?: number;
}

let memCache: AerolitoIndexFile | null = null;

function safeStore() {
  try {
    return getStore(STORE_NAME);
  } catch (e) {
    if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return null;
    throw e;
  }
}

export function __resetAerolitoCacheForTests(): void {
  memCache = null;
}

function cosineSimilarity(a: number[], b: number[]): number {
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

async function loadIndex(): Promise<AerolitoIndexFile> {
  if (memCache) return memCache;
  const s = safeStore();
  if (!s) { memCache = { chunks: [] }; return memCache; }

  let raw: unknown = null;
  try {
    raw = await s.get(INDEX_KEY, { type: "json" });
  } catch (err) {
    console.error("aerolito-vector.loadIndex: blob read failed", err);
    return { chunks: [] };
  }
  if (!raw || typeof raw !== "object") {
    memCache = { chunks: [] };
    return memCache;
  }
  const candidate = raw as AerolitoIndexFile;
  if (!Array.isArray(candidate.chunks)) {
    console.error("aerolito-vector.loadIndex: malformed, ignoring");
    memCache = { chunks: [] };
    return memCache;
  }
  memCache = candidate;
  return memCache;
}

async function saveIndex(index: AerolitoIndexFile): Promise<void> {
  const s = safeStore();
  if (!s) return;
  await s.setJSON(INDEX_KEY, index);
  memCache = index;
}

export async function appendAerolitoChunk(chunk: AerolitoChunk): Promise<void> {
  const idx = await loadIndex();
  const next: AerolitoIndexFile = { chunks: [...idx.chunks.filter(c => c.id !== chunk.id), chunk] };
  await saveIndex(next);
}

export async function searchAerolito(queryVec: number[], opts: AerolitoSearchOptions = {}): Promise<AerolitoHit[]> {
  const k = opts.k ?? 5;
  const threshold = opts.threshold ?? 0.5;
  const idx = await loadIndex();
  if (idx.chunks.length === 0) return [];
  return idx.chunks
    .filter(c => c.vector.length === queryVec.length)
    .map(c => ({
      id: c.id,
      text: c.text,
      questionIdx: c.questionIdx,
      score: cosineSimilarity(queryVec, c.vector),
    }))
    .filter(h => h.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function resetAerolitoIndex(): Promise<void> {
  const s = safeStore();
  if (!s) { memCache = { chunks: [] }; return; }
  try {
    await s.delete(INDEX_KEY);
  } catch (err) {
    console.error("aerolito-vector.resetAerolitoIndex: delete failed", err);
  }
  memCache = { chunks: [] };
}

export async function getAerolitoChunkCount(): Promise<number> {
  const idx = await loadIndex();
  return idx.chunks.length;
}

export async function dumpAllAerolitoChunks(): Promise<AerolitoChunk[]> {
  const idx = await loadIndex();
  return idx.chunks;
}
