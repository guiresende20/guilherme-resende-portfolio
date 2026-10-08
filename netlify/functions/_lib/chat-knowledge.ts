import { isLatestBlogQuery, isChatRuntimeQuery, type KnowledgeResult } from "../../../src/lib/chat-grounding";
import { retrieveKnowledge } from "./rag";
import { retrieveLatestBlogPost } from "./latest-blog";

export async function retrieveChatKnowledge(query: string, timeoutMs = 5000): Promise<KnowledgeResult> {
  // Operational questions use the current runtime source in the shared prompt.
  // Historical blog descriptions must not overwrite the running configuration.
  if (!isLatestBlogQuery(query) && isChatRuntimeQuery(query)) return { status: "no_results", sources: [] };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    return await Promise.race([
      isLatestBlogQuery(query) ? retrieveLatestBlogPost(controller.signal) : retrieveKnowledge(query, controller.signal),
      new Promise<KnowledgeResult>(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ status: "timeout", sources: [] }); }, timeoutMs); }),
    ]);
  } catch {
    return { status: "error", sources: [] };
  } finally { clearTimeout(timer); }
}
