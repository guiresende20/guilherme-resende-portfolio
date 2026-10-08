import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), start: vi.fn(), model: vi.fn(), retrieve: vi.fn() }));
vi.mock("@google/generative-ai", async importOriginal => ({
  ...await importOriginal<typeof import("@google/generative-ai")>(),
  GoogleGenerativeAI: class { getGenerativeModel = mocks.model; },
}));
vi.mock("../_lib/ratelimit", () => ({ checkRateLimits: () => ({ ok: true }) }));
vi.mock("../_lib/blobs-context", () => ({ ensureBlobsContext: vi.fn() }));
vi.mock("../_lib/chat-knowledge", () => ({ retrieveChatKnowledge: mocks.retrieve }));
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
  mocks.start.mockReturnValue({ sendMessage: mocks.send });
  mocks.model.mockReturnValue({ startChat: mocks.start });
  mocks.send.mockResolvedValue({ response: { text: () => JSON.stringify({ text: "Olá!", actions: [], references: [] }), candidates: [{ finishReason: "STOP" }] } });
});
describe("barreiras de entrega do chat", () => {
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
