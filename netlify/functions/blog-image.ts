import type { Handler } from "@netlify/functions";
import { listFolder, downloadBinary } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCachedBinary, setCachedBinary } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";

function contentTypeForName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
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

  // event.path may be the original /api/blog/image/:filename or the rewritten
  // /.netlify/functions/blog-image/:filename depending on environment.
  const remainder = event.path
    .replace(/^\/api\/blog\/image\//, "")
    .replace(/^\/\.netlify\/functions\/blog-image\//, "");
  const rawName = remainder.split("/")[0].split("?")[0];
  const filename = rawName ? decodeURIComponent(rawName) : null;
  if (!filename) return { statusCode: 400, body: "filename required" };

  // Reject path traversal attempts.
  if (filename.includes("/") || filename.includes("..")) {
    return { statusCode: 400, body: "invalid filename" };
  }

  const baseHeaders: Record<string, string> = {
    ...(allowed ? corsHeaders(origin, "GET") : {}),
    "content-type": contentTypeForName(filename),
    "cache-control": "public, max-age=31536000, immutable",
  };

  const cacheKey = `images/${filename}`;
  const cached = await getCachedBinary(cacheKey);
  if (cached) {
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: cached.toString("base64"),
      isBase64Encoded: true,
    };
  }

  const folders = await resolveBlogFolders();
  if (!folders.imagesId) {
    return { statusCode: 404, body: "images folder not found" };
  }

  const files = await listFolder(folders.imagesId);
  const file = files.find((f) => f.name === filename);
  if (!file) return { statusCode: 404, body: "image not found" };

  const data = await downloadBinary(file.id);
  await setCachedBinary(cacheKey, data);

  return {
    statusCode: 200,
    headers: baseHeaders,
    body: data.toString("base64"),
    isBase64Encoded: true,
  };
};
