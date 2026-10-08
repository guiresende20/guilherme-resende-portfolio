import { chunk as chunkMarkdown } from "./chunker";
import { embedBatch, embedText } from "./embeddings";
import type { KnowledgeResult } from "../../../src/lib/chat-grounding";
import { blogKnowledgeText } from "../../../src/lib/blog/knowledge-text";
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
  const trimmed = blogKnowledgeText(body ?? "");
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

export async function retrieveKnowledge(query: string, signal?: AbortSignal): Promise<KnowledgeResult> {
  const start = Date.now();
  const trimmed = (query ?? "").trim();
  if (!trimmed) return { status: "no_results", sources: [] };
  let queryVec: number[];
  try {
    queryVec = await embedText(trimmed, { signal, timeout: 4500 });
  } catch (err) {
    console.error("rag: embeddings_failed");
    return { status: "error", sources: [] };
  }
  let hits;
  if (signal?.aborted) return { status: "timeout", sources: [] };
  try {
    hits = await searchSimilar(queryVec, { k: TOP_K, threshold: THRESHOLD, maxPerPost: MAX_PER_POST, strict: true });
  } catch (err) {
    console.error("rag: store_failed");
    return { status: "error", sources: [] };
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
    return { status: "no_results", sources: [] };
  }
  console.log(
    `rag.retrieveRelevantChunks: hits=${hits.length} topScore=${hits[0].score.toFixed(2)} elapsedMs=${Date.now() - start}`,
  );
  const sources = hits.filter(h => typeof h.slug === "string" && /^[a-zA-Z0-9_-]+$/.test(h.slug) && typeof h.text === "string" && h.text.trim()).map((h, i) => ({
    id: `blog:${h.slug}:${h.chunkIdx ?? i}`,
    title: `${h.sourceTitle}${h.headingPath ? ` — ${h.headingPath}` : ""}`.slice(0, 250),
    text: blogKnowledgeText(h.text).slice(0, 6000), url: `/blog/${h.slug}`,
  })).filter(source => source.text.trim());
  return { status: sources.length ? "ok" : "no_results", sources };
}

// Compatibilidade com os consumidores anteriores; o chat novo usa o resultado tipado.
export async function retrieveRelevantChunks(query: string): Promise<string> {
  const result = await retrieveKnowledge(query);
  if (result.status !== "ok") return "";
  return RAG_HEADER + result.sources.map(s => `[${s.title}] (${s.url})\n${s.text}`).join(RAG_SEPARATOR) + "\n";
}
