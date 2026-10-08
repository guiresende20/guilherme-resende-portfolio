import type { KnowledgeResult } from "../../../src/lib/chat-grounding";
import { blogKnowledgeText } from "../../../src/lib/blog/knowledge-text";
import { listFolder } from "./drive";
import { resolveBlogFolders } from "./blog-folders";
import { fetchAndParse, isBlogPostSource } from "./blog-source";

export async function retrieveLatestBlogPost(signal: AbortSignal): Promise<KnowledgeResult> {
  const folders = await resolveBlogFolders();
  const files = (await listFolder(folders.rootId)).filter(isBlogPostSource);
  if (signal.aborted) return { status: "timeout", sources: [] };
  // Read all metadata, including Docs. A partial catalog cannot prove recency.
  const posts = await Promise.all(files.map(file => fetchAndParse(file, { withImages: false })));
  if (signal.aborted) return { status: "timeout", sources: [] };
  const published = posts.filter(post => !post.meta.draft);
  if (!published.length) return { status: "no_results", sources: [] };
  const slugs = new Set<string>();
  for (const { meta } of published) {
    if (!/^[a-zA-Z0-9_-]+$/.test(meta.slug) || slugs.has(meta.slug) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || !Number.isFinite(Date.parse(meta.date)) ||
        new Date(meta.date).toISOString().slice(0, 10) !== meta.date || meta.date === "1970-01-01") {
      throw new Error("blog_catalog_invalid");
    }
    slugs.add(meta.slug);
  }
  published.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || a.meta.slug.localeCompare(b.meta.slug));
  const { meta, body } = published[0];
  const tied = published.filter(post => post.meta.date === meta.date).length > 1;
  const selection = `${tied ? "Um dos posts mais recentes" : "O post mais recente"} entre os posts publicados consultados é “${meta.title}”, publicado em ${meta.date}.`;
  return { status: "ok", sources: [{
    id: `blog:${meta.slug}:latest`, title: meta.title.slice(0, 250), url: `/blog/${meta.slug}`,
    text: `${selection}\n\n${blogKnowledgeText(body)}`.slice(0, 6000),
  }] };
}
