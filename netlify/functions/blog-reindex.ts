import type { Handler } from "@netlify/functions";
import { listFolder, downloadText, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { parsePost } from "../../src/lib/blog/frontmatter";
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
      total: mdFiles.length,
      indexed,
      failed: errors.length,
      errors,
      storedChunks,
      storedSlugs,
    }),
  };
};
