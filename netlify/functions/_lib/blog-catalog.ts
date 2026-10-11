import { MAX_ANSWER_CHARS, type KnowledgeResult } from "../../../src/lib/chat-grounding";
import type { ChatResponse } from "../../../src/lib/gemini";
import { listFolder } from "./drive";
import { resolveBlogFolders } from "./blog-folders";
import { fetchAndParse, isBlogPostSource } from "./blog-source";

export async function readPublishedBlogPosts(signal: AbortSignal) {
  const folders = await resolveBlogFolders();
  const files = (await listFolder(folders.rootId)).filter(isBlogPostSource);
  signal.throwIfAborted();
  // A failed file must not silently turn a partial catalog into a complete list.
  const posts = await Promise.all(files.map(file => fetchAndParse(file, { withImages: false })));
  signal.throwIfAborted();
  const published = posts.filter(post => !post.meta.draft);
  const slugs = new Set<string>();
  for (const { meta } of published) {
    if (!meta.title?.trim() || !/^[a-zA-Z0-9_-]+$/.test(meta.slug) || slugs.has(meta.slug) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || !Number.isFinite(Date.parse(meta.date)) ||
        new Date(meta.date).toISOString().slice(0, 10) !== meta.date || meta.date === "1970-01-01") {
      throw new Error("blog_catalog_invalid");
    }
    slugs.add(meta.slug);
  }
  return published.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || a.meta.slug.localeCompare(b.meta.slug));
}

export async function retrieveBlogCatalog(signal: AbortSignal): Promise<KnowledgeResult> {
  const posts = await readPublishedBlogPosts(signal);
  return { status: posts.length ? "ok" : "no_results", sources: posts.map(({ meta }) => ({
    id: `blog:${meta.slug}:catalog`, title: meta.title, url: `/blog/${meta.slug}`,
    text: `Título: ${meta.title}\nData de publicação: ${meta.date}`,
  })) };
}

export function buildBlogCatalogAnswer(knowledge: KnowledgeResult, message: string): ChatResponse {
  const english = /\b(?:list|titles|which|what|your)\b/i.test(message);
  const spanish = !english && /\b(?:tus|sus|cuales|articulos)\b/i.test(message.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  const intro = english ? "My published posts, newest first:" : spanish ? "Mis posts publicados, del más reciente al más antiguo:" : "Meus posts publicados, do mais recente ao mais antigo:";
  const empty = english ? "No published posts were found in the catalog." : spanish ? "No se encontraron posts publicados en el catálogo." : "Não encontrei posts publicados no catálogo consultado.";
  const more = english ? "See the complete list in the Blog section." : spanish ? "Consulta la lista completa en la sección Blog." : "Veja a lista completa na seção Blog.";
  const rows: string[] = [];
  for (const source of knowledge.sources) {
    const row = `${rows.length + 1}. ${source.title}`;
    // Leave space to disclose omissions when the catalog outgrows a chat bubble.
    if ([intro, ...rows, row, more].join("\n").length > MAX_ANSWER_CHARS) break;
    rows.push(row);
  }
  const omitted = rows.length < knowledge.sources.length;
  const text = !knowledge.sources.length ? empty : [intro, ...rows, ...(omitted ? [more] : [])].join("\n");
  return { text, actions: [{ type: "scroll", label: english ? "Blog" : spanish ? "Ver blog" : "Ver blog", section: "blog" }],
    sources: knowledge.sources.slice(0, rows.length).map(({ id, title, url }) => ({ id, title, url })) };
}
