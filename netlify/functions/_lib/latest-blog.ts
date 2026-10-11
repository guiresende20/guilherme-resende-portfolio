import type { KnowledgeResult } from "../../../src/lib/chat-grounding";
import { blogKnowledgeText } from "../../../src/lib/blog/knowledge-text";
import { readPublishedBlogPosts } from "./blog-catalog";

export async function retrieveLatestBlogPost(signal: AbortSignal): Promise<KnowledgeResult> {
  const published = await readPublishedBlogPosts(signal);
  if (!published.length) return { status: "no_results", sources: [] };
  const { meta, body } = published[0];
  const tied = published.filter(post => post.meta.date === meta.date).length > 1;
  const selection = `${tied ? "Um dos posts mais recentes" : "O post mais recente"} entre os posts publicados consultados é “${meta.title}”, publicado em ${meta.date}.`;
  return { status: "ok", sources: [{
    id: `blog:${meta.slug}:latest`, title: meta.title.slice(0, 250), url: `/blog/${meta.slug}`,
    text: `${selection}\n\n${blogKnowledgeText(body)}`.slice(0, 6000),
  }] };
}
