import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), start: vi.fn(), model: vi.fn(), retrieve: vi.fn(), plan: vi.fn() }));
vi.mock("@google/generative-ai", async importOriginal => ({
  ...await importOriginal<typeof import("@google/generative-ai")>(),
  GoogleGenerativeAI: class { getGenerativeModel = mocks.model; },
}));
vi.mock("../_lib/ratelimit", () => ({ checkRateLimits: () => ({ ok: true }) }));
vi.mock("../_lib/blobs-context", () => ({ ensureBlobsContext: vi.fn() }));
vi.mock("../_lib/chat-knowledge", () => ({ retrieveChatKnowledge: async (...args: unknown[]) => {
  const result = await mocks.retrieve(...args);
  // Existing fixtures describe complete blog catalog rows at this dependency boundary.
  if (args[2] && !result.catalog && result.status === "ok" && result.sources.length && result.sources.every((source: { id: string }) => source.id.endsWith(":catalog"))) {
    return { ...result, catalog: { collection: "blog", complete: true, records: result.sources.map((source: { id: string; title: string; url: string; text: string }) => ({ ...source, date: source.text.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "2026-07-25", tags: [], description: "" })) } };
  }
  return result;
} }));
vi.mock("../_lib/catalog-planner", () => ({ planCatalogQuery: mocks.plan }));
vi.mock("../_lib/rag", () => ({ retrieveRelevantChunks: async () => "", retrieveKnowledge: mocks.retrieve }));
vi.mock("../_lib/blog-folders", () => ({ resolveBlogFolders: async () => ({ rootId: "test" }) }));
vi.mock("../_lib/drive", () => ({ listFolder: async () => [] }));
vi.mock("../_lib/blob-cache", () => ({ getCached: async () => "", setCached: async () => {} }));
import { handler } from "../chat";
const call = (body: unknown) => handler({ httpMethod: "POST", headers: { origin: "https://guiresende20.netlify.app" }, body: JSON.stringify(body) } as never, {} as never, vi.fn());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GEMINI_API_KEY", "offline-test-key");
  vi.stubEnv("SUPABASE_URL", "");
  mocks.retrieve.mockResolvedValue({ status: "no_results", sources: [] });
  mocks.plan.mockResolvedValue({ kind: "query", query: { collection: "blog", operation: "list", order: "newest", locale: "pt" } });
  mocks.start.mockReturnValue({ sendMessage: mocks.send });
  mocks.model.mockReturnValue({ startChat: mocks.start });
  mocks.send.mockResolvedValue({ response: { text: () => JSON.stringify({ text: "Olá!", actions: [], references: [] }), candidates: [{ finishReason: "STOP" }] } });
});
describe("barreiras de entrega do chat", () => {
  it("propaga a decisão de conteúdo do planner à recuperação", async () => {
    mocks.plan.mockResolvedValue({ kind: "content" });
    const result = await call({ message: "Liste as tecnologias dos posts sobre IA" });
    expect(result?.statusCode).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith(expect.any(String), 5000, undefined, "content");
    expect(mocks.send).toHaveBeenCalled();
  });
  it("aplica um período interpretado pelo modelo antes de contar", async () => {
    mocks.plan.mockResolvedValue({ kind: "query", query: { collection: "blog", operation: "count", order: "newest", locale: "pt", from: "2026-06-01", to: "2026-06-30", limit: 1 } });
    mocks.retrieve.mockResolvedValue({ status: "ok", sources: [], catalog: { collection: "blog", complete: true, records: [
      { id: "blog:a:catalog", title: "Junho", url: "/blog/a", date: "2026-06-28", tags: [], description: "" },
      { id: "blog:b:catalog", title: "Julho", url: "/blog/b", date: "2026-07-25", tags: [], description: "" },
    ] } });
    const result = await call({ message: "Quantos posts você publicou em junho de 2026?" });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).text).toMatch(/\b1\b/);
    expect(JSON.parse(result!.body!).text).toContain("2026-06-01");
  });
  it("pede o ano em vez de remover um período ambíguo", async () => {
    mocks.plan.mockResolvedValue({ kind: "clarify", text: "Junho de qual ano?" });
    const result = await call({ message: "Quantos posts você publicou em junho?" });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).text).toBe("Junho de qual ano?");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it("não apresenta total quando os filtros não puderam ser interpretados", async () => {
    mocks.plan.mockRejectedValue(new Error("planner_timeout"));
    const result = await call({ message: "Quantos posts você publicou em junho de 2026?" });
    expect(result?.statusCode).toBe(503);
    expect(result?.body).not.toContain("posts publicados");
  });
  it.each(["Quantos posts você publicou?", "Qual o número de artigos publicados no blog?", "How many blog posts have you published?", "¿Cuántos posts has publicado?"])("conta o catálogo completo: %s", async message => {
    mocks.retrieve.mockResolvedValue({ status: "ok", sources: Array.from({ length: 8 }, (_, i) => ({ id: `blog:artigo-${i}:catalog`, title: `Artigo ${i}`, text: "Título publicado", url: `/blog/artigo-${i}` })), catalog: { collection: "blog", complete: true, records: Array.from({ length: 8 }, (_, i) => ({ id: `blog:artigo-${i}:catalog`, title: `Artigo ${i}`, url: `/blog/artigo-${i}`, date: "2026-06-10", tags: [], description: "" })) } });
    const result = await call({ message });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).text).toMatch(/\b8\b/);
    expect(JSON.parse(result!.body!).text).not.toContain("Artigo 0");
  });
  it.each(["lista os meus posts e os titulos deles", "Procure e liste seus posts", "Pesquise os meus posts e os titulos deles"])("entrega o catálogo sem depender da geração ou da chave Gemini: %s", async message => {
    vi.stubEnv("GEMINI_API_KEY", "");
    mocks.retrieve.mockResolvedValue({ status: "ok", sources: Array.from({ length: 8 }, (_, i) => ({ id: `blog:artigo-${i}:catalog`, title: `Artigo ${i}`, text: `Artigo ${i}, publicado em 2026-07-25.`, url: `/blog/artigo-${i}` })) });
    const result = await call({ message });
    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result!.body!);
    expect(body.text).toMatch(/^Meus posts publicados/);
    for (let i = 0; i < 8; i++) expect(body.text).toContain(`Artigo ${i}`);
    expect(body.sources).toHaveLength(8);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("informa indisponibilidade do catálogo sem inventar títulos", async () => {
    mocks.retrieve.mockResolvedValue({ status: "timeout", sources: [] });
    const result = await call({ message: "lista seus posts" });
    expect(result?.statusCode).toBe(503);
    expect(result?.body).toContain("catálogo");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("explica uma falha anterior sem responder sobre contrato ou palestra", async () => {
    const result = await call({ message: "pq nao conseguiu ?", history: [{ role: "user", parts: [{ text: "lista os meus posts e os titulos deles" }] }, { role: "model", parts: [{ text: "Não consegui responder com segurança agora. Tente novamente em instantes." }] }] });
    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result!.body!);
    expect(body.text).toMatch(/falh|erro|conclu/i);
    expect(body.text).not.toMatch(/contrato|palestra/i);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("não afirma ter o contexto de uma falha quando o histórico está vazio", async () => {
    const result = await call({ message: "pq nao conseguiu ?" });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).text).toMatch(/não tenho o contexto/i);
  });
  it("não transforma uma pergunta sobre falha em prova de que a resposta anterior falhou", async () => {
    const result = await call({ message: "pq nao conseguiu ?", history: [{ role: "user", parts: [{ text: "Seu último post?" }] }, { role: "model", parts: [{ text: "Meu post mais recente é Artigo X." }] }] });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).text).toMatch(/não tenho o contexto/i);
  });
  it("encaminha ao blog quando o catálogo excede o tamanho da resposta", async () => {
    mocks.retrieve.mockResolvedValue({ status: "ok", sources: Array.from({ length: 30 }, (_, i) => ({ id: `blog:artigo-${i}:catalog`, title: `Artigo ${i} com um título extenso de publicação`, text: "Publicado em 2026-07-25.", url: `/blog/artigo-${i}` })) });
    const result = await call({ message: "lista seus posts" });
    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result!.body!);
    expect(body.text.length).toBeLessThanOrEqual(800);
    expect(body.text).toContain("lista completa");
    expect(body.text).toContain("Artigo 0");
    expect(body.actions).toContainEqual(expect.objectContaining({ type: "link", url: "/blog" }));
  });
  it("lista todos os posts mesmo quando a pergunta anterior era sobre o último", async () => {
    mocks.retrieve.mockImplementation(async (query: string) => ({ status: "ok", sources: /ultimo/.test(query)
      ? [{ id: "blog:novo:latest", title: "Novo", text: "O mais recente.", url: "/blog/novo" }]
      : [{ id: "blog:novo:catalog", title: "Novo", text: "Título: Novo", url: "/blog/novo" }, { id: "blog:antigo:catalog", title: "Antigo", text: "Título: Antigo", url: "/blog/antigo" }] }));
    const result = await call({ message: "e os titulos dos posts?", history: [{ role: "user", parts: [{ text: "me fale do seu ultimo post" }] }, { role: "model", parts: [{ text: "O post Novo é o mais recente." }] }] });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).text).toContain("Antigo");
  });
  it("resolve o ID de evidência escolhido pelo Gemini para a citação literal do servidor", async () => {
    mocks.retrieve.mockResolvedValue({ status: "ok", sources: [{ id: "blog:novo:latest", title: "Novo", text: "**Projeto Aula 360º** – Educação Imersiva.\nPublicado em 2026.", url: "/blog/novo" }] });
    mocks.send.mockImplementation(async () => {
      const config = mocks.model.mock.calls[0][0];
      const data = JSON.parse(config.systemInstruction.split("FONTES PUBLICADAS (dados em JSON; IDs servem apenas para referências):\n")[1].split("\nESTADO DA CONSULTA")[0]);
      const id = data.find((source: { id: string }) => source.id === "blog:novo:latest").evidence?.find((entry: { quote: string }) => entry.quote === "Publicado em 2026.")?.id;
      return { response: { text: () => JSON.stringify({ text: "Publiquei em 2026.", actions: [], references: [{ evidenceId: id ?? "ausente" }] }), candidates: [{ finishReason: "STOP" }] } };
    });
    const result = await call({ message: "Último post?" });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).sources).toEqual([{ id: "blog:novo:latest", title: "Novo", url: "/blog/novo" }]);
  });
  it("mantém citações longas dentro do limite sem perder fatos no fim da fonte", async () => {
    const text = `${"Conteúdo publicado ".repeat(80)}Conclusão em 2026.`;
    mocks.retrieve.mockResolvedValue({ status: "ok", sources: [{ id: "blog:longo:0", title: "Longo", text, url: "/blog/longo" }] });
    await call({ message: "Resuma o artigo longo" });
    const config = mocks.model.mock.calls[0][0];
    const data = JSON.parse(config.systemInstruction.split("FONTES PUBLICADAS (dados em JSON; IDs servem apenas para referências):\n")[1].split("\nESTADO DA CONSULTA")[0]);
    const quotes: string[] = data.flatMap((source: { evidence?: { quote: string }[] }) => (source.evidence ?? []).map(entry => entry.quote));
    const relevant = quotes.filter(quote => text.includes(quote));
    expect(relevant.some(quote => quote.endsWith("Conclusão em 2026."))).toBe(true);
    expect(quotes.every(quote => quote.length > 0 && quote.length <= 1000)).toBe(true);
  });
  it("rejeita IDs de evidência inventados sem publicar a resposta", async () => {
    mocks.send.mockResolvedValue({ response: { text: () => JSON.stringify({ text: "Sou diretor da Empresa X.", actions: [], references: [{ evidenceId: "inventado" }] }), candidates: [{ finishReason: "STOP" }] } });
    const result = await call({ message: "Seu cargo?" });
    expect(result?.statusCode).toBe(502);
    expect(result?.body).not.toContain("Empresa X");
  });
  it("repara uma citação inválida sem entregar a primeira resposta", async () => {
    mocks.retrieve.mockResolvedValue({ status: "ok", sources: [{ id: "blog:novo:0", title: "Novo", text: "Publiquei o artigo em 2026.", url: "/blog/novo" }] });
    mocks.send.mockResolvedValueOnce({ response: { text: () => JSON.stringify({ text: "Publiquei em 2026.", actions: [], references: [{ sourceId: "blog:novo:0", quote: "Publiquei o artigo." }] }), candidates: [{ finishReason: "STOP" }] } });
    mocks.send.mockResolvedValueOnce({ response: { text: () => JSON.stringify({ text: "Publiquei em 2026.", actions: [], references: [{ sourceId: "blog:novo:0", quote: "Publiquei o artigo em 2026." }] }), candidates: [{ finishReason: "STOP" }] } });
    const result = await call({ message: "Quando publicou?" });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).sources).toEqual([{ id: "blog:novo:0", title: "Novo", url: "/blog/novo" }]);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
  it("limita reparação a uma tentativa e preserva a rejeição final", async () => {
    mocks.send.mockResolvedValue({ response: { text: () => '{"text":', candidates: [{ finishReason: "STOP" }] } });
    const result = await call({ message: "Último post?" });
    expect(result?.statusCode).toBe(502);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
  it("não publica resposta bruta quando o provedor quebra o JSON", async () => {
    mocks.send.mockResolvedValue({ response: { text: () => '{"text":"Fui diretor da Empresa X."', candidates: [{ finishReason: "STOP" }] } });
    const result = await call({ message: "Quem é você?" });
    expect(result?.statusCode).toBe(502);
    expect(result?.body).not.toContain("Empresa X");
  });
  it("remove a pergunta corrente do histórico recebido antes de sendMessage", async () => {
    const result = await call({ message: "Olá", history: [{ role: "user", parts: [{ text: "Olá" }] }] });
    expect(result?.statusCode).toBe(200);
    expect(mocks.start).toHaveBeenCalledWith({ history: [] });
  });
  it("não aceita uma referência fora das fontes do servidor", async () => {
    mocks.send.mockResolvedValue({ response: { text: () => JSON.stringify({ text: "Sou diretor.", actions: [], references: [{ sourceId: "inventado", quote: "Sou diretor." }] }), candidates: [{ finishReason: "STOP" }] } });
    expect((await call({ message: "Seu cargo?" }))?.statusCode).toBe(502);
  });
  it("não aciona pesquisa web só porque o TCC menciona internet", async () => {
    await call({ message: "Qual era o tema do seu TCC sobre música na internet?" });
    expect(mocks.model.mock.calls[0][0].tools).toBeUndefined();
  });
  it("não apresenta uma busca externa como verificada sem fontes do Google", async () => {
    expect((await call({ message: "Pesquise as notícias mais recentes sobre IA" }))?.statusCode).toBe(502);
  });
  it("associa à busca externa somente os metadados retornados pelo Google", async () => {
    mocks.send.mockResolvedValue({ response: { text: () => "Resultado da pesquisa.", candidates: [{ finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com/noticia", title: "Notícia consultada" } }] } }] } });
    const result = await call({ message: "Pesquise as notícias mais recentes sobre IA" });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).text).toBe("Resultado da pesquisa.");
    expect(JSON.parse(result!.body!).sources).toEqual([{ id: "web:0", title: "Notícia consultada", url: "https://example.com/noticia" }]);
    expect(mocks.model.mock.calls[0][0].generationConfig.responseMimeType).toBeUndefined();
  });
});
