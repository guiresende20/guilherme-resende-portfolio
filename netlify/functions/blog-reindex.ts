import type { Handler } from "@netlify/functions";
import { listFolder, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
import { indexPost } from "./_lib/rag";
import { loadIndex, __resetCacheForTests } from "./_lib/vector-store";
import { ensureBlobsContext } from "./_lib/blobs-context";

interface ReindexError {
  slug: string;
  error: string;
}

export const handler: Handler = async (event) => {
  ensureBlobsContext(event);
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

  const sources = files.filter(isBlogPostSource);

  const errors: ReindexError[] = [];
  const seen = new Set<string>();
  const perSlug: Record<string, { chunks: number; bodyLen: number; mimeType: string }> = {};
  let indexed = 0;
  for (const f of sources) {
    try {
      const { meta, body } = await fetchAndParse(f);
      if (meta.draft) continue;
      if (seen.has(meta.slug)) {
        console.error("blog: duplicate slug, skipping", { slug: meta.slug, name: f.name });
        continue;
      }
      seen.add(meta.slug);
      const result = await indexPost(meta.slug, body, meta.title);
      perSlug[meta.slug] = { chunks: result.chunks, bodyLen: body.length, mimeType: f.mimeType };
      indexed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`blog-reindex: failed slug=${f.name}`, err);
      errors.push({ slug: f.name, error: msg });
    }
  }

  // Diagnostic readback: bypass memCache and load fresh from blob.
  __resetCacheForTests();
  let storedChunks = -1;
  let storedSlugs: string[] = [];
  try {
    const idx = await loadIndex();
    storedChunks = idx.chunks.length;
    storedSlugs = [...new Set(idx.chunks.map((c) => c.slug))];
  } catch (err) {
    console.error("blog-reindex: diagnostic loadIndex failed", err);
  }

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      total: sources.length,
      indexed,
      failed: errors.length,
      errors,
      storedChunks,
      storedSlugs,
      perSlug,
    }),
  };
};
