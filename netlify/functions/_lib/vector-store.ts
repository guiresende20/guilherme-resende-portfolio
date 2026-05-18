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
