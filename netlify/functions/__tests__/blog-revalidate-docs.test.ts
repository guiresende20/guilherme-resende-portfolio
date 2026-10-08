import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), parse: vi.fn(), index: vi.fn(), remove: vi.fn() }));
vi.mock("../_lib/drive", () => ({ listFolder: mocks.list, downloadText: vi.fn() }));
vi.mock("../_lib/blog-folders", () => ({ resolveBlogFolders: async () => ({ rootId: "blog" }) }));
vi.mock("../_lib/blog-source", () => ({
  isBlogPostSource: (file: { mimeType: string }) => file.mimeType === "application/vnd.google-apps.document",
  fetchAndParse: mocks.parse,
}));
vi.mock("../_lib/blob-cache", () => ({ deleteCached: async () => {}, deleteByPrefix: async () => {} }));
vi.mock("../_lib/rag", () => ({ indexPost: mocks.index, removePost: mocks.remove }));
vi.mock("../_lib/blobs-context", () => ({ ensureBlobsContext: () => {} }));
import { handler } from "../blog-revalidate";
const call = (query: string) => handler({ httpMethod: "POST", headers: { "x-revalidate-token": "test" }, rawUrl: `https://guiresende20.netlify.app/api/blog/revalidate?${query}` } as never, {} as never, vi.fn());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOG_REVALIDATE_TOKEN", "test");
  mocks.list.mockResolvedValue([{ id: "doc", name: "Novo post", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-10-08", createdTime: "2026-10-08" }]);
  mocks.parse.mockResolvedValue({ meta: { slug: "novo", title: "Novo", draft: false }, body: "Conteúdo publicado." });
  mocks.index.mockResolvedValue({ chunks: 1 });
});
it("revalida um post do Google Docs sem removê-lo do RAG", async () => {
  const result = await call("slug=novo");
  expect(JSON.parse(result!.body!)).toMatchObject({ rag: { indexed: true, chunks: 1 } });
  expect(mocks.index).toHaveBeenCalledWith("novo", "Conteúdo publicado.", "Novo");
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("inclui Docs na revalidação completa", async () => {
  const result = await call("all=true");
  expect(JSON.parse(result!.body!)).toMatchObject({ reindexed: 1, failed: 0 });
});
