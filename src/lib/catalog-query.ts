export type CatalogCollection = "blog" | "projects" | "publications";
export interface CatalogRecord { id: string; title: string; url: string; date?: string; tags: readonly string[]; description: string }
export interface CatalogSnapshot { collection: CatalogCollection; complete: boolean; records: readonly CatalogRecord[] }
export interface CatalogQuery {
  collection: CatalogCollection; operation: "list" | "count"; order: "newest" | "oldest" | "title";
  locale: "pt" | "en" | "es"; limit?: number; offset?: number; from?: string; to?: string; text?: string; tag?: string;
}
export interface CatalogQueryResult { query: CatalogQuery; total: number; records: CatalogRecord[]; complete: boolean }
export class UnsupportedCatalogQuery extends Error {}
export const normalizeCatalogText = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateCatalogQuery(value: unknown): CatalogQuery {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_catalog_query");
  const query = value as Record<string, unknown>;
  const fields = new Set(["collection", "operation", "order", "locale", "limit", "offset", "from", "to", "text", "tag"]);
  if (Object.keys(query).some(key => !fields.has(key)) ||
      !["blog", "projects", "publications"].includes(String(query.collection)) ||
      !["list", "count"].includes(String(query.operation)) || !["newest", "oldest", "title"].includes(String(query.order)) ||
      !["pt", "en", "es"].includes(String(query.locale))) throw new Error("invalid_catalog_query");
  for (const field of ["from", "to", "text", "tag"] as const) {
    if (query[field] !== undefined && (typeof query[field] !== "string" || (query[field] as string).length > 200)) throw new Error("invalid_catalog_filter");
  }
  for (const field of ["from", "to"] as const) if (query[field] && !validDate(query[field] as string)) throw new Error("invalid_catalog_date");
  if (query.from && query.to && query.from > query.to) throw new Error("invalid_catalog_period");
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || Number(query.limit) < 1 || Number(query.limit) > 1000)) throw new Error("invalid_catalog_limit");
  if (query.offset !== undefined && (!Number.isInteger(query.offset) || Number(query.offset) < 0 || Number(query.offset) > 100000)) throw new Error("invalid_catalog_offset");
  return query as unknown as CatalogQuery;
}

function matchesText(record: CatalogRecord, search: string): boolean {
  const words = (text: string) => normalizeCatalogText(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const haystack = ` ${words([record.title, record.description, ...record.tags].join(" "))} `;
  const needle = words(search);
  const aliases = ["ia", "ai", "inteligencia artificial", "artificial intelligence"].includes(needle)
    ? ["ia", "ai", "inteligencia artificial", "artificial intelligence"] : [needle];
  return aliases.some(alias => haystack.includes(` ${alias} `));
}

export function executeCatalogQuery(catalog: CatalogSnapshot, input: CatalogQuery): CatalogQueryResult {
  const query = validateCatalogQuery(input);
  if (query.collection !== catalog.collection) throw new Error("catalog_collection_mismatch");
  if ((query.from || query.to || query.order !== "title") && catalog.records.some(record => !record.date || !validDate(record.date))) {
    throw new UnsupportedCatalogQuery("Não tenho as datas de publicação de todos os registros para aplicar esse período ou ordenar por recência.");
  }
  const ids = new Set<string>();
  for (const record of catalog.records) {
    if (!record.id || ids.has(record.id) || !record.title?.trim()) throw new Error("catalog_record_invalid");
    ids.add(record.id);
  }
  const matches = catalog.records.filter(record =>
    (!query.from || record.date! >= query.from) && (!query.to || record.date! <= query.to) &&
    (!query.text || matchesText(record, query.text)) &&
    (!query.tag || record.tags.some(tag => normalizeCatalogText(tag) === normalizeCatalogText(query.tag!))));
  matches.sort((a, b) => query.order === "title" ? a.title.localeCompare(b.title, query.locale) || a.id.localeCompare(b.id)
    : (query.order === "newest" ? b.date!.localeCompare(a.date!) : a.date!.localeCompare(b.date!)) || a.id.localeCompare(b.id));
  return { query, total: matches.length, records: matches.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 1000)), complete: catalog.complete };
}
