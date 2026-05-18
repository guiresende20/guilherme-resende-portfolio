import type { Handler } from "@netlify/functions";
import { deleteCached, deleteByPrefix } from "./_lib/blob-cache";
import { listFolder, downloadText, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { parsePost } from "../../src/lib/blog/frontmatter";
import { indexPost, removePost as ragRemovePost } from "./_lib/rag";

async function listMdFiles(): Promise<DriveFile[]> {
  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  return files.filter((f) => {
    if (!f.name.endsWith(".md")) return false;
    if (f.mimeType.startsWith("application/vnd.google-apps.")) return false;
    return true;
  });
}

async function reindexSlug(slug: string): Promise<
  | { indexed: true; chunks: number }
  | { indexed: false; removed: true }
  | { indexed: false; error: string }
> {
  const mdFiles = await listMdFiles();
  for (const f of mdFiles) {
    const raw = await downloadText(f.id);
    const { meta, body } = parsePost(raw, f.name);
    if (meta.slug !== slug) continue;
    if (meta.draft) {
      await ragRemovePost(slug);
      return { indexed: false, removed: true };
    }
    const { chunks } = await indexPost(slug, body, meta.title);
    return { indexed: true, chunks };
  }
  // Slug not found in Drive — treat as deletion
  await ragRemovePost(slug);
  return { indexed: false, removed: true };
}

export const handler: Handler = async (event) => {
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

  const url = new URL(event.rawUrl);
  const slug = url.searchParams.get("slug");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    await deleteByPrefix("posts/");
    // Full reindex inline (cheap for small Ns; for many posts use /api/blog/reindex)
    let indexed = 0;
    let failed = 0;
    try {
      const mdFiles = await listMdFiles();
      for (const f of mdFiles) {
        try {
          const raw = await downloadText(f.id);
          const { meta, body } = parsePost(raw, f.name);
          if (meta.draft) continue;
          await indexPost(meta.slug, body, meta.title);
          indexed += 1;
        } catch (err) {
          console.error(`blog-revalidate: reindex failed file=${f.name}`, err);
          failed += 1;
        }
      }
    } catch (err) {
      console.error("blog-revalidate: drive list failed in ?all=true", err);
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ cleared: "posts/*", reindexed: indexed, failed }),
    };
  }

  if (!slug) {
    return { statusCode: 400, body: "slug required (or pass ?all=true)" };
  }

  await deleteCached("posts/list");
  await deleteCached(`posts/${slug}`);
  await deleteCached("posts/prompt-summary"); // chatbot summary uses same source

  let ragResult: Awaited<ReturnType<typeof reindexSlug>> | { indexed: false; error: string };
  try {
    ragResult = await reindexSlug(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`blog-revalidate: rag reindex failed slug=${slug}`, err);
    ragResult = { indexed: false, error: msg };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      cleared: [`posts/list`, `posts/${slug}`, `posts/prompt-summary`],
      rag: ragResult,
    }),
  };
};
