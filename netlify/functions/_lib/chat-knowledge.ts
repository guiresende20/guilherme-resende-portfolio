import type { KnowledgeResult } from "../../../src/lib/chat-grounding";
import { retrieveKnowledge } from "./rag";

export async function retrieveChatKnowledge(query: string, timeoutMs = 5000): Promise<KnowledgeResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    return await Promise.race([
      retrieveKnowledge(query, controller.signal),
      new Promise<KnowledgeResult>(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ status: "timeout", sources: [] }); }, timeoutMs); }),
    ]);
  } catch {
    return { status: "error", sources: [] };
  } finally { clearTimeout(timer); }
}
