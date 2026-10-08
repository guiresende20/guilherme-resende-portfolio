import { afterEach, expect, it, vi } from "vitest";
const retrieve = vi.hoisted(() => vi.fn());
const blog = vi.hoisted(() => ({ list: vi.fn(), parse: vi.fn() }));
vi.mock("../rag", () => ({ retrieveKnowledge: retrieve }));
vi.mock("../drive", () => ({ listFolder: blog.list }));
vi.mock("../blog-folders", () => ({ resolveBlogFolders: async () => ({ rootId: "blog" }) }));
vi.mock("../blog-source", () => ({ isBlogPostSource: () => true, fetchAndParse: blog.parse }));
import { retrieveChatKnowledge } from "../chat-knowledge";
afterEach(() => { vi.useRealTimers(); retrieve.mockReset(); blog.list.mockReset(); blog.parse.mockReset(); });
it("encerra a espera com timeout e aborta a recuperação pendente", async () => {
  vi.useFakeTimers();
  retrieve.mockReturnValue(new Promise(() => {}));
  const response = retrieveChatKnowledge("Aula", 10);
  await vi.advanceTimersByTimeAsync(11);
  expect(await response).toEqual({ status: "timeout", sources: [] });
  expect(retrieve.mock.calls[0][1]?.aborted).toBe(true);
});

const post = (slug: string, date: string, draft = false, featured = false) => ({
  meta: { slug, title: slug, date, draft, featured, lang: "pt", tags: [], readingTimeMin: 1 },
  body: `Conteúdo de ${slug}.\n\n[image1]: <data:image/jpeg;base64,/9j/AAAA>`,
});
it.each(["me fale do seu ultimo post", "What is your latest blog post?", "Háblame de tu último artículo"])("seleciona pela data publicada: %s", async query => {
  retrieve.mockResolvedValue({ status: "no_results", sources: [] });
  blog.list.mockResolvedValue([{ id: "antigo" }, { id: "novo" }, { id: "rascunho" }]);
  blog.parse.mockImplementation(async (file: { id: string }) => file.id === "antigo" ? post("antigo", "2026-05-23", false, true) : file.id === "novo" ? post("novo", "2026-07-25") : post("rascunho", "2026-10-08", true));
  const result = await retrieveChatKnowledge(query);
  expect(result.status).toBe("ok");
  expect(result.sources).toEqual([expect.objectContaining({ url: "/blog/novo", title: "novo" })]);
  expect(result.sources[0].text).toContain("2026-07-25");
  expect(result.sources[0].text).toContain("Conteúdo de novo.");
  expect(result.sources[0].text).not.toContain("base64");
});
it("não declara o último post quando parte do catálogo falha", async () => {
  retrieve.mockResolvedValue({ status: "no_results", sources: [] });
  blog.list.mockResolvedValue([{ id: "a" }, { id: "b" }]);
  blog.parse.mockImplementation(async (file: { id: string }) => { if (file.id === "b") throw new Error("Drive down"); return post("a", "2026-05-23"); });
  expect(await retrieveChatKnowledge("seu post mais recente")).toEqual({ status: "error", sources: [] });
});
it("não interpreta notícias externas como último post do blog", async () => {
  retrieve.mockResolvedValue({ status: "no_results", sources: [] });
  expect(await retrieveChatKnowledge("latest news about AI")).toEqual({ status: "no_results", sources: [] });
  expect(blog.list).not.toHaveBeenCalled();
});
it("retorna no_results quando não há posts publicados", async () => {
  retrieve.mockResolvedValue({ status: "ok", sources: [] });
  blog.list.mockResolvedValue([{ id: "draft" }]);
  blog.parse.mockResolvedValue(post("draft", "2026-10-08", true));
  expect(await retrieveChatKnowledge("última publicação do blog")).toEqual({ status: "no_results", sources: [] });
});
it("não usa datas inválidas para comprovar recência", async () => {
  retrieve.mockResolvedValue({ status: "ok", sources: [] });
  blog.list.mockResolvedValue([{ id: "a" }]);
  blog.parse.mockResolvedValue(post("a", "2026-02-30"));
  expect(await retrieveChatKnowledge("último artigo")).toEqual({ status: "error", sources: [] });
});
it("encerra com timeout quando o catálogo não responde", async () => {
  vi.useFakeTimers();
  blog.list.mockReturnValue(new Promise(() => {}));
  const result = retrieveChatKnowledge("último post", 10);
  await vi.advanceTimersByTimeAsync(11);
  expect(await result).toEqual({ status: "timeout", sources: [] });
});
it.each(["vc consegue acessar os posts do seu blog?", "se vc postar no blog, isso alimenta automaticamente o seu rag?", "Does your blog automatically update your RAG?"])("não usa descrições históricas como configuração atual: %s", async query => {
  retrieve.mockResolvedValue({ status: "ok", sources: [{ id: "blog:antigo:0", title: "Versão antiga", text: "A lista atualiza a cada 10 minutos.", url: "/blog/antigo" }] });
  expect(await retrieveChatKnowledge(query)).toEqual({ status: "no_results", sources: [] });
});
it.each(["Resuma seu post Da rancheta ao prompt", "No seu post 'Por trás deste blog', como o RAG era atualizado?", "Me fale do seu artigo sobre atualização de prompts"])("preserva consultas ao conteúdo dos artigos: %s", async query => {
  const result = { status: "ok", sources: [{ id: "blog:artigo:0", title: "Artigo", text: "Relato da versão anterior.", url: "/blog/artigo" }] };
  retrieve.mockResolvedValue(result);
  expect(await retrieveChatKnowledge(query)).toEqual(result);
});
