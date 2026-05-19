import type { Handler } from "@netlify/functions";
import { listFolder } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
import type { PostMeta } from "../../src/lib/blog/frontmatter";
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
  const sources = files.filter(isBlogPostSource);

  const metas: PostMeta[] = [];
  const seen = new Set<string>();
  for (const file of sources) {
    try {
      const { meta } = await fetchAndParse(file);
      if (meta.draft) continue;
      if (seen.has(meta.slug)) {
        console.error("blog: duplicate slug, skipping", { slug: meta.slug, name: file.name });
        continue;
      }
      seen.add(meta.slug);
      metas.push(meta);
    } catch (err) {
      console.error("blog: skipping", { name: file.name, id: file.id, err });
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
