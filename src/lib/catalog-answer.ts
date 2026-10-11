import { MAX_ANSWER_CHARS } from "./chat-grounding";
import type { ChatResponse, ChatAction } from "./gemini";
import type { CatalogQueryResult } from "./catalog-query";

export function buildCatalogAnswer(result: CatalogQueryResult): ChatResponse {
  const { query, total } = result;
  const en = query.locale === "en", es = query.locale === "es";
  const section = query.collection === "blog" ? "blog" : query.collection === "projects" ? "projetos" : "formacao";
  const catalogUrl = query.collection === "blog" ? "/blog" : `#${section}`;
  const actionLabel = en ? "View catalog" : "Ver catálogo";
  const actions: ChatAction[] = query.collection === "blog" ? [{ type: "link", label: actionLabel, url: catalogUrl }] : [{ type: "scroll", label: actionLabel, section }];
  const noun = query.collection === "blog" ? (en ? "published posts" : es ? "posts publicados" : "posts publicados")
    : query.collection === "projects" ? (en ? "projects listed in the portfolio" : es ? "proyectos del portafolio" : "projetos listados no portfólio")
    : (en ? "scientific articles mentioned in the published sources" : es ? "artículos científicos mencionados en las fuentes" : "artigos científicos mencionados na base publicada");
  const conditions = [query.from || query.to ? `${en ? "period" : es ? "período" : "período"}: ${query.from || "…"} — ${query.to || "…"}` : "",
    query.text ? `${en ? "text in titles, summaries or tags" : es ? "texto en títulos, resúmenes o etiquetas" : "texto em títulos, resumos ou tags"}: “${query.text}”` : "",
    query.tag ? `tag: “${query.tag}”` : ""].filter(Boolean);
  const filters = conditions.length ? ` (${conditions.join("; ")})` : "";
  const partial = result.complete ? "" : en ? " This list is incomplete; I cannot confirm the total number of published articles."
    : es ? " Esta lista es parcial; no puedo confirmar el total de artículos publicados." : " Essa lista é parcial; não consigo confirmar o total de artigos publicados.";
  const count = en ? `The catalog contains ${total} ${noun}${filters}.` : es ? `El catálogo contiene ${total} ${noun}${filters}.` : `O catálogo contém ${total} ${noun}${filters}.`;
  const intro = en ? `My ${noun} (${total} matching records)${filters}:` : es ? `Mis ${noun} (${total} registros encontrados)${filters}:`
    : `Meus ${noun} (${total} registros encontrados)${filters}:`;
  const more = en ? "See the complete list in the corresponding section." : es ? "Consulta la lista completa en la sección correspondiente." : "Veja a lista completa na seção correspondente.";
  const sources = [{ id: `catalog:${query.collection}:result`, title: en ? "Published catalog query" : es ? "Consulta al catálogo publicado" : "Consulta ao catálogo publicado", url: catalogUrl }];
  if (query.operation === "count" || !total) return { text: (count + partial).slice(0, MAX_ANSWER_CHARS), actions, sources };
  const rows: string[] = [];
  for (const record of result.records) {
    const row = `${(query.offset ?? 0) + rows.length + 1}. ${record.title}${record.date ? ` — ${record.date}` : ""}`;
    if ([intro, ...rows, row, partial, more].join("\n").length > MAX_ANSWER_CHARS) break;
    rows.push(row);
  }
  const omitted = rows.length < result.total;
  const text = [intro, ...rows, ...(partial ? [partial.trim()] : []), ...(omitted ? [more] : [])].join("\n");
  return { text, actions,
    sources: [...sources, ...result.records.slice(0, rows.length).map(({ id, title, url }) => ({ id, title: title.slice(0, 250), url }))].slice(0, 8) };
}
