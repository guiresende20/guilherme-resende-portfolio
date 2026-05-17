import type { Handler } from "@netlify/functions";
import { deleteCached, deleteByPrefix } from "./_lib/blob-cache";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const expectedToken = process.env.BLOG_REVALIDATE_TOKEN;
  if (!expectedToken) {
    return { statusCode: 500, body: "BLOG_REVALIDATE_TOKEN not configured" };
  }

  const provided = event.headers["x-revalidate-token"] || event.headers["X-Revalidate-Token"];
  if (provided !== expectedToken) {
    return { statusCode: 401, body: "Invalid or missing token" };
  }

  const url = new URL(event.rawUrl);
  const slug = url.searchParams.get("slug");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    await deleteByPrefix("posts/");
    return { statusCode: 200, body: JSON.stringify({ cleared: "posts/*" }) };
  }

  if (!slug) {
    return { statusCode: 400, body: "slug required (or pass ?all=true)" };
  }

  await deleteCached("posts/list");
  await deleteCached(`posts/${slug}`);
  // Keep translation cache — translations of unchanged-pt posts stay valid.

  return { statusCode: 200, body: JSON.stringify({ cleared: [`posts/list`, `posts/${slug}`] }) };
};
