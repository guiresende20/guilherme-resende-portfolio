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
    mocks.send.mockResolvedValue({ response: { text: () => JSON.stringify({ text: "Resultado da pesquisa.", actions: [], references: [] }), candidates: [{ finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com/noticia", title: "Notícia consultada" } }] } }] } });
    const result = await call({ message: "Pesquise as notícias mais recentes sobre IA" });
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result!.body!).sources).toEqual([{ id: "web:0", title: "Notícia consultada", url: "https://example.com/noticia" }]);
  });
});
