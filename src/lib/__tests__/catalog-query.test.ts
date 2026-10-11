import { describe, expect, it } from "vitest";
import { executeCatalogQuery, validateCatalogQuery, type CatalogSnapshot } from "../catalog-query";
import { buildCatalogAnswer } from "../catalog-answer";
import { classifyCatalogIntent } from "../catalog-intent";

const catalog: CatalogSnapshot = { collection: "blog", complete: true, records: [
  { id: "blog:a:catalog", title: "IA no design", url: "/blog/a", date: "2026-06-01", tags: ["IA"], description: "Experimentos" },
  { id: "blog:b:catalog", title: "Educação", url: "/blog/b", date: "2026-06-30", tags: ["Educação"], description: "Aprendizagem" },
  { id: "blog:c:catalog", title: "Outro experimento", url: "/blog/c", date: "2026-07-25", tags: [], description: "Inteligência artificial aplicada" },
] };
const query = (overrides = {}) => validateCatalogQuery({ collection: "blog", operation: "list", order: "newest", locale: "pt", ...overrides });
describe("consultas sobre inventários publicados", () => {
  it("conta antes de limitar e paginar", () => {
    const result = executeCatalogQuery(catalog, query({ operation: "count", limit: 1, offset: 1 }));
    expect(result.total).toBe(3);
    expect(result.records.map(record => record.title)).toEqual(["Educação"]);
    expect(buildCatalogAnswer(result).text).toMatch(/3 posts publicados/);
  });
  it("filtra um período incluindo os dois limites", () => {
    const result = executeCatalogQuery(catalog, query({ from: "2026-06-01", to: "2026-06-30" }));
    expect(result.total).toBe(2);
    expect(result.records.map(record => record.title)).toEqual(["Educação", "IA no design"]);
  });
  it("seleciona os últimos N pela data e os primeiros pela ordem inversa", () => {
    expect(executeCatalogQuery(catalog, query({ limit: 2 })).records.map(record => record.title)).toEqual(["Outro experimento", "Educação"]);
    expect(executeCatalogQuery(catalog, query({ order: "oldest", limit: 1 })).records[0].title).toBe("IA no design");
  });
  it("filtra tags literalmente e texto nos metadados publicados", () => {
    expect(executeCatalogQuery(catalog, query({ tag: "educacao" })).total).toBe(1);
    expect(executeCatalogQuery(catalog, query({ text: "IA" })).total).toBe(2);
    expect(executeCatalogQuery(catalog, query({ text: "palestra" })).total).toBe(0);
  });
  it("não usa IA como substring de uma palavra", () => {
    const result = executeCatalogQuery({ ...catalog, records: [{ ...catalog.records[0], title: "Praia", tags: [], description: "Viagem" }] }, query({ text: "IA" }));
    expect(result.total).toBe(0);
  });
  it.each([{ from: "2026-02-30" }, { from: "2026-07-01", to: "2026-06-01" }, { limit: -1 }, { offset: 0.5 }, { collection: "secrets" }, { operation: "delete" }, { sql: "DROP TABLE posts" }])("recusa parâmetros inválidos: %j", input => {
    expect(() => query(input)).toThrow();
  });
  it("não apresenta um catálogo acadêmico parcial como total de artigos", () => {
    const result = executeCatalogQuery({ collection: "publications", complete: false, records: catalog.records.slice(0, 2) }, query({ collection: "publications", operation: "count", order: "title" }));
    expect(buildCatalogAnswer(result).text).toMatch(/parcial|incompleta/);
    expect(buildCatalogAnswer(result).text).toMatch(/não consigo confirmar o total/);
  });
  it("pede dados de publicação quando não há datas para ordenar", () => {
    expect(() => executeCatalogQuery({ collection: "projects", complete: true, records: [{ ...catalog.records[0], date: undefined }] }, query({ collection: "projects" }))).toThrow(/datas/);
  });
  it("indica os registros omitidos sem alterar a contagem", () => {
    const result = executeCatalogQuery({ ...catalog, records: Array.from({ length: 50 }, (_, i) => ({ ...catalog.records[0], id: `blog:p${i}:catalog`, title: `Post ${i} com um título suficientemente longo`, url: `/blog/p${i}` })) }, query());
    const answer = buildCatalogAnswer(result);
    expect(answer.text.length).toBeLessThanOrEqual(800);
    expect(answer.text).toContain("50");
    expect(answer.text).toMatch(/lista completa/);
    expect(answer.actions).toContainEqual({ type: "link", label: "Ver catálogo", url: "/blog" });
    expect(answer.sources?.[0].url).toBe("/blog");
  });
  it.each(["lista os meus posts e os titulos deles", "Quantos posts você publicou?", "Liste seus projetos", "Quantos artigos científicos publicou?", "Quais são seus três últimos posts?"])("reconhece operações de catálogo: %s", message => {
    expect(classifyCatalogIntent(message, [])).not.toBeNull();
  });
  it.each(["Resuma seu post Da rancheta ao prompt", "Liste os principais pontos do artigo", "Quando você publicou o post Casa nova?", "Quantos alunos participaram da palestra no seu post?"])("preserva perguntas sobre o conteúdo: %s", message => {
    expect(classifyCatalogIntent(message, [])).toBeNull();
  });
  it("resolve uma contagem de continuação pela pergunta anterior, sem usar fatos do modelo", () => {
    const history = [{ role: "user" as const, parts: [{ text: "Liste os posts do seu blog" }] }, { role: "model" as const, parts: [{ text: "Inventei 999 projetos." }] }];
    expect(classifyCatalogIntent("e quantos são?", history)?.collection).toBe("blog");
  });
  it("preserva a operação e o catálogo em uma continuação com novo filtro", () => {
    const history = [{ role: "user" as const, parts: [{ text: "Quantos posts você publicou em 2026?" }] }, { role: "model" as const, parts: [{ text: "Inventei 999." }] }];
    const intent = classifyCatalogIntent("e só os de junho?", history);
    expect(intent?.collection).toBe("blog");
    expect(intent?.operation).toBe("count");
    expect(intent?.needsPlanner).toBe(true);
  });
  it("lista e conta em uma pergunta composta", () => {
    expect(classifyCatalogIntent("Quantos posts você publicou? Liste os títulos.", [])?.operation).toBe("list");
  });
  it.each(["e quantos posts?", "and how many posts?"])("mantém filtros numa continuação que repete o nome do catálogo: %s", message => {
    const history = [{ role: "user" as const, parts: [{ text: "Liste posts de junho de 2026 sobre IA" }] }, { role: "model" as const, parts: [{ text: "Alguns posts." }] }];
    expect(classifyCatalogIntent(message, history)?.needsPlanner).toBe(true);
  });
  it.each(["Liste posts de IA", "Liste posts relacionados a educação", "Liste posts sem IA"])("não ignora filtros na passagem rápida: %s", message => {
    expect(classifyCatalogIntent(message, [])?.needsPlanner).toBe(true);
  });
  it.each(["Count your posts last month", "List your posts from March", "Liste seus posts por título"])("envia modificadores desconhecidos para interpretação: %s", message => {
    expect(classifyCatalogIntent(message, [])?.needsPlanner).toBe(true);
  });
  it.each(["Liste seus posts e projetos", "Quantos posts e projetos você tem?", "Liste seus projetos e publicações", "List your projects and papers", "Liste seus posts científicos"])("não descarta uma segunda coleção ou uma qualificação temática: %s", message => {
    expect(classifyCatalogIntent(message, [])?.needsPlanner).toBe(true);
  });
  it.each(["Qual o total de visualizações dos seus posts?", "Qual foi o número de usuários do seu projeto Portobello?"])("não conta a coleção quando a pergunta trata de outra entidade: %s", message => {
    expect(classifyCatalogIntent(message, [])).toBeNull();
  });
  it.each([["Lista tus proyectos", "projects", "es"], ["List your papers", "publications", "en"], ["Count my blog posts", "blog", "en"]])("reconhece a coleção e idioma: %s", (message, collection, locale) => {
    expect(classifyCatalogIntent(message, [])).toMatchObject({ collection, locale });
  });
});
