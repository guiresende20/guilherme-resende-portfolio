import { chunk as chunkMarkdown } from "./chunker";
import { embedBatch, embedText } from "./embeddings";
import {
  removePost,
  replacePostChunks,
  searchSimilar,
  type StoredChunk,
} from "./vector-store";

export { removePost } from "./vector-store";

const RAG_HEADER = "\n\n---\n\nTRECHOS RELEVANTES DO BLOG (use quando responder):\n\n";
const RAG_SEPARATOR = "\n---\n";
const TOP_K = 5;
const THRESHOLD = 0.5;
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
    let bestBelow = 0;
    try {
      const probe = await searchSimilar(queryVec, { k: 1, threshold: 0, maxPerPost: MAX_PER_POST });
      bestBelow = probe[0]?.score ?? 0;
    } catch {
      // ignore — diagnostic only
    }
    console.log(
      `rag.retrieveRelevantChunks: hits=0 bestBelowThreshold=${bestBelow.toFixed(3)} threshold=${THRESHOLD} elapsedMs=${Date.now() - start}`,
    );
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
