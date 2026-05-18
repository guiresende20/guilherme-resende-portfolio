import type { Handler } from "@netlify/functions";
import { listFolder, downloadText, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { parsePost, type PostMeta } from "../../src/lib/blog/frontmatter";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";

const TTL_MS = 10 * 60_000; // 10 min

export const handler: Handler = async (event) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "GET"), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const headers: Record<string, string> = {
    ...(allowed ? corsHeaders(origin, "GET") : {}),
    "content-type": "application/json",
    "cache-control": "public, max-age=60",
  };

  const cacheKey = "posts/list";
  const cached = await getCached<PostMeta[]>(cacheKey);
  if (cached) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: cached, cached: true }),
    };
  }

  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const mdFiles: DriveFile[] = [];
  for (const f of files) {
    if (!f.name.endsWith(".md")) continue;
    if (f.mimeType.startsWith("application/vnd.google-apps.")) {
      // Drive auto-converted this upload to a native Google Doc; cannot be
      // downloaded as raw text. Owner must re-upload with conversion disabled.
      console.warn(`Skipping "${f.name}": stored as ${f.mimeType} (Google-converted, not raw markdown)`);
      continue;
    }
    mdFiles.push(f);
  }

  const metas: PostMeta[] = [];
  for (const file of mdFiles) {
    try {
      const raw = await downloadText(file.id);
      const { meta } = parsePost(raw, file.name);
      if (!meta.draft) metas.push(meta);
    } catch (err) {
      console.error("Failed to parse", file.name, err);
    }
  }

  metas.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  await setCached(cacheKey, metas, TTL_MS);
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ posts: metas, cached: false }),
  };
};
