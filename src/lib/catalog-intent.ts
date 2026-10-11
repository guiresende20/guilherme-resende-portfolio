import type { ChatHistory } from "./gemini";
import { normalizeCatalogText, type CatalogQuery, type CatalogCollection } from "./catalog-query";

export interface CatalogIntent { collection: CatalogCollection; operation: "list" | "count"; locale: "pt" | "en" | "es"; needsPlanner: boolean; query: CatalogQuery }
const subjects = "posts?|blog|artigos?|articulos?|articles?|papers?|projetos?|proyectos?|projects?|publicacoes|publicaciones|publications";
const countTarget = new RegExp(`\\b(?:quantos?|quantas?|cuantos?|cuantas?|numero|quantidade|total|count|how\\s+many|number)\\s+(?:(?:de|do|da|dos|das|of|my|your|seus?|suas?|meus?|minhas?|teus?|tuas?|tus?|sus?)\\s+)*(?:${subjects})\\b`);
// Only unqualified inventory requests skip interpretation. Any unknown modifier
// (date, topic, exclusion, ordering, etc.) must be preserved by the planner.
const plainWords = new Set(normalizeCatalogText(`
  lista liste listar list lists listing mostre mostrar mostra show enumerate enumerar enumere enumera muestra
  procure procurar pesquise pesquisar search find busca buscar
  titulos titulo titles title quais quantos quantas qual numero quantidade total count how many number which what cuantos cuantas cuales
  os as o a e and y de do da dos das del los las el la no na neste nessa nesse the of
  seu sua seus suas meu minha meus minhas teus tuas tus sus your my their deles delas
  you voce vc eu tenho tem sao son hay have has are is do does
  blog blogs post posts artigo artigos article articles articulo articulos paper papers
  projeto projetos project projects proyecto proyectos publicacao publicacoes publication publications publicacion publicaciones
  publicado publicados publicadas publicada publicou publiquei published publish portfolio
  cientifico cientificos cientificas academic scientific academicos academicas favor please porfavor
`).split(/\s+/).filter(Boolean));
export function classifyCatalogIntent(message: string, history: readonly ChatHistory[]): CatalogIntent | null {
  const current = normalizeCatalogText(message);
  // A list of arguments inside an article is a content question, not an inventory.
  if (/\b(?:resum\w*|summari[sz]\w*|pontos?|points?|argumentos?|arguments?|ideias?|ideas?|trechos?|excerpts?)\b/.test(current) ||
      /\b(?:web|google|online)\b|(?:na|pela|on the|en la)\s+internet/.test(current)) return null;
  const count = countTarget.test(current);
  const followupCount = /^(?:e\s+|and\s+|y\s+)?(?:quantos?\s+(?:sao|tem|foram)|how\s+many|cuantos?\s+son)\s*[?!.]*$/.test(current);
  const explicitList = /\b(?:list\w*|titulos?|titles?|mostr\w*|show|enumer\w*)\b/.test(current);
  const list = explicitList || /\b(?:quais|which|what|cuales)\b/.test(current);
  const continuation = /^(?:e|and|y)\s+(?:so|apenas|somente|only|just|os|as|seus?|suas?|your|los|las|tus?|em|en|antes|depois|before|after)\b/.test(current);
  if (!count && !list && !followupCount && !continuation) return null;
  const hasSubject = new RegExp(`\\b(?:${subjects})\\b`).test(current);
  let prior: CatalogIntent | null = null;
  if (!hasSubject) {
    if (!followupCount && !continuation && !/^(?:e|and|y)\b/.test(current)) return null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role !== "user") continue;
      prior = classifyCatalogIntent(history[i].parts.map(part => part.text).join(" "), history.slice(0, i));
      break;
    }
    if (!prior) return null;
  }
  const collection: CatalogCollection = prior?.collection ?? (/\b(?:blog|posts?)\b/.test(current) ? "blog"
    : /\b(?:projetos?|proyectos?|projects?)\b/.test(current) ? "projects"
    : /\b(?:academ\w*|cientific\w*|scientific|academic|papers?|publicacoes|publicaciones|publications)\b/.test(current) ? "publications" : "blog");
  const locale = /\b(?:how|many|your|my|count|list|titles|which|what|number|projects|articles|papers)\b/.test(current) ? "en"
    : /\b(?:tus|sus|cuantos|cuantas|cuales|articulos|proyectos|publicaciones)\b/.test(current) ? "es" : prior?.locale ?? "pt";
  const operation = explicitList ? "list" : count || followupCount ? "count" : prior?.operation ?? "list";
  const academicArticle = /\b(?:artigos?|articles?|articulos?)\b/.test(current) && /\b(?:cientific\w*|scientific|academic|academ\w*)\b/.test(current);
  const multipleCollections = [
    /\b(?:blog|posts?)\b/.test(current) || !academicArticle && /\b(?:artigos?|articles?|articulos?)\b/.test(current),
    /\b(?:projetos?|proyectos?|projects?)\b/.test(current),
    academicArticle || /\b(?:papers?|publicacoes|publicaciones|publications)\b/.test(current),
  ].filter(Boolean).length > 1;
  const qualifiedOtherCollection = collection !== "publications" && /\b(?:cientific\w*|scientific|academic|academ\w*)\b/.test(current);
  const needsPlanner = !hasSubject || multipleCollections || qualifiedOtherCollection || /^(?:e|and|y)\b/.test(current) || current.split(/[^a-z0-9]+/).filter(Boolean).some(word => !plainWords.has(word));
  return { collection, operation, locale, needsPlanner, query: { collection, operation, locale, order: collection === "blog" ? "newest" : "title" } };
}
