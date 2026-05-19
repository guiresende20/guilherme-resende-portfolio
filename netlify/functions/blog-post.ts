import type { Handler } from "@netlify/functions";
import { listFolder } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
import type { PostMeta } from "../../src/lib/blog/frontmatter";
import { rewriteImagePaths } from "../../src/lib/blog/image-paths";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";

const TTL_MS = 10 * 60_000;

interface PostPayload {
  meta: PostMeta;
  body: string;
}

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

  const baseHeaders: Record<string, string> = {
    ...(allowed ? corsHeaders(origin, "GET") : {}),
    "content-type": "application/json",
    "cache-control": "public, max-age=60",
  };

  // event.path may be the original /api/blog/post/:slug or the rewritten
  // /.netlify/functions/blog-post/:slug depending on environment.
  const remainder = event.path
    .replace(/^\/api\/blog\/post\//, "")
    .replace(/^\/\.netlify\/functions\/blog-post\//, "");
  const slug = remainder.split("/")[0].split("?")[0] || null;
  if (!slug) {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "slug required" }) };
  }

  const cacheKey = `posts/${slug}`;
  const cached = await getCached<PostPayload>(cacheKey);
  if (cached) {
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ ...cached, cached: true }),
    };
  }

  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const sources = files.filter(isBlogPostSource);

  let found: PostPayload | null = null;
  for (const file of sources) {
    try {
      const parsed = await fetchAndParse(file);
      if (parsed.meta.slug === slug && !parsed.meta.draft) {
        found = {
          meta: parsed.meta,
          body: rewriteImagePaths(parsed.body),
        };
        break;
      }
    } catch (err) {
      console.error("blog: skipping", { name: file.name, id: file.id, err });
    }
  }

  if (!found) {
    return {
      statusCode: 404,
      headers: baseHeaders,
      body: JSON.stringify({ error: "not_found", slug }),
    };
  }

  await setCached(cacheKey, found, TTL_MS);
  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify({ ...found, cached: false }),
  };
};
