import pt from "../../../src/locales/pt.json";
import { PORTFOLIO_SOURCES } from "../../../src/lib/portfolio-knowledge";
import type { KnowledgeResult } from "../../../src/lib/chat-grounding";
import type { CatalogCollection, CatalogRecord, CatalogSnapshot } from "../../../src/lib/catalog-query";
import { readPublishedBlogPosts } from "./blog-catalog";

export async function readCatalog(collection: CatalogCollection, signal: AbortSignal): Promise<KnowledgeResult> {
  let catalog: CatalogSnapshot;
  if (collection === "blog") {
    const posts = await readPublishedBlogPosts(signal);
    catalog = { collection, complete: true, records: posts.map(({ meta }) => ({
      id: `blog:${meta.slug}:catalog`, title: meta.title, url: `/blog/${meta.slug}`, date: meta.date,
      tags: meta.tags.filter(tag => typeof tag === "string"), description: meta.excerpt ?? "",
    })) };
  } else if (collection === "projects") {
    catalog = { collection, complete: true, records: pt.projects.items.map((project, i) => ({
      id: `project:${i}:catalog`, title: project.title, url: "#projetos", tags: project.tags,
      description: project.desc,
    })) };
  } else {
    const academic = PORTFOLIO_SOURCES.find(source => source.id === "profile:15");
    const records: CatalogRecord[] = [...(academic?.text ?? "").matchAll(/Artigo —[^\n]+\nNo artigo “([^”]+)”([^\n]+)/g)].map((match, i) => ({
      id: `publication:${i}:catalog`, title: match[1], description: match[2], url: "#formacao", tags: [],
    }));
    // Mentioned examples are never a complete bibliography or an exact career total.
    catalog = { collection, complete: false, records };
  }
  signal.throwIfAborted();
  return { status: catalog.records.length ? "ok" : "no_results", catalog, sources: catalog.records.map(record => ({
    id: record.id, title: record.title.slice(0, 250), url: record.url,
    text: `Título: ${record.title}${record.date ? `\nData de publicação: ${record.date}` : ""}\nTags: ${record.tags.join(", ")}\nDescrição: ${record.description}`,
  })) };
}
