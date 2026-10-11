import { isLatestBlogQuery, isBlogCatalogQuery, isChatRuntimeQuery, type KnowledgeResult } from "../../../src/lib/chat-grounding";
import { retrieveKnowledge } from "./rag";
import { retrieveLatestBlogPost } from "./latest-blog";
import { retrieveBlogCatalog } from "./blog-catalog";
import { readCatalog } from "./catalog-reader";
import type { CatalogQuery } from "../../../src/lib/catalog-query";

export async function retrieveChatKnowledge(query: string, timeoutMs = 5000, catalogQuery?: CatalogQuery, mode: "auto" | "content" = "auto"): Promise<KnowledgeResult> {
  // Operational questions use the current runtime source in the shared prompt.
  // Historical blog descriptions must not overwrite the running configuration.
  if (mode === "auto" && !catalogQuery && !isLatestBlogQuery(query) && !isBlogCatalogQuery(query) && isChatRuntimeQuery(query)) return { status: "no_results", sources: [] };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    return await Promise.race([
      catalogQuery ? readCatalog(catalogQuery.collection, controller.signal) : mode === "content" ? retrieveKnowledge(query, controller.signal) : isLatestBlogQuery(query) ? retrieveLatestBlogPost(controller.signal) : isBlogCatalogQuery(query) ? retrieveBlogCatalog(controller.signal) : retrieveKnowledge(query, controller.signal),
      new Promise<KnowledgeResult>(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ status: "timeout", sources: [] }); }, timeoutMs); }),
    ]);
  } catch {
    return { status: "error", sources: [] };
  } finally { clearTimeout(timer); }
}
