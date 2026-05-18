import { describe, it, expect, vi, beforeEach } from "vitest";

const embedTextMock = vi.fn();
const embedBatchMock = vi.fn();
vi.mock("../embeddings", () => ({
  EMBEDDING_DIM: 8,
  EMBEDDING_MODEL: "text-embedding-004",
  embedText: embedTextMock,
  embedBatch: embedBatchMock,
}));

const replacePostChunksMock = vi.fn();
const removePostMock = vi.fn();
const searchSimilarMock = vi.fn();
vi.mock("../vector-store", () => ({
  replacePostChunks: replacePostChunksMock,
  removePost: removePostMock,
  searchSimilar: searchSimilarMock,
}));

beforeEach(() => {
  embedTextMock.mockReset();
  embedBatchMock.mockReset();
  replacePostChunksMock.mockReset();
  removePostMock.mockReset();
  searchSimilarMock.mockReset();
});

describe("indexPost", () => {
  it("chunks, embeds, and stores", async () => {
    const { indexPost } = await import("../rag");
    // Return one 8-dim vector per input text (matches chunker output length)
    embedBatchMock.mockImplementation(async (texts: string[]) =>
      texts.map(() => new Array(8).fill(0.1)),
    );
    const longBody = "parágrafo um.\n\n" + "Lorem ipsum dolor sit amet. ".repeat(200);
    const result = await indexPost("hello", longBody, "Hello World");
    expect(result.chunks).toBeGreaterThan(0);
    expect(embedBatchMock).toHaveBeenCalledOnce();
    expect(replacePostChunksMock).toHaveBeenCalledWith(
      "hello",
      expect.arrayContaining([
        expect.objectContaining({ slug: "hello", sourceTitle: "Hello World" }),
      ]),
    );
  });

  it("calls removePost when body is empty", async () => {
    const { indexPost } = await import("../rag");
    const result = await indexPost("empty", "", "Empty");
    expect(result.chunks).toBe(0);
    expect(removePostMock).toHaveBeenCalledWith("empty");
    expect(replacePostChunksMock).not.toHaveBeenCalled();
    expect(embedBatchMock).not.toHaveBeenCalled();
  });
});

describe("retrieveRelevantChunks", () => {
  it("formats hits with header and separators", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockResolvedValue(new Array(8).fill(0.1));
    searchSimilarMock.mockResolvedValue([
      { slug: "a", text: "Trecho A.", headingPath: "## Sec A", sourceTitle: "Post A", score: 0.9 },
      { slug: "b", text: "Trecho B.", headingPath: "## Sec B", sourceTitle: "Post B", score: 0.8 },
    ]);
    const out = await retrieveRelevantChunks("pergunta");
    expect(out).toContain("TRECHOS RELEVANTES DO BLOG");
    expect(out).toContain("[Post A — ## Sec A] (/blog/a)");
    expect(out).toContain("Trecho A.");
    expect(out).toContain("[Post B — ## Sec B] (/blog/b)");
    expect(out).toContain("Trecho B.");
  });

  it("returns empty string when no hits", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockResolvedValue(new Array(8).fill(0.1));
    searchSimilarMock.mockResolvedValue([]);
    expect(await retrieveRelevantChunks("nada")).toBe("");
  });

  it("returns empty string and does not throw when embedText fails", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockRejectedValue(new Error("api down"));
    expect(await retrieveRelevantChunks("x")).toBe("");
  });

  it("returns empty string and does not throw when searchSimilar fails", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    embedTextMock.mockResolvedValue(new Array(8).fill(0.1));
    searchSimilarMock.mockRejectedValue(new Error("store down"));
    expect(await retrieveRelevantChunks("x")).toBe("");
  });

  it("returns empty string when query is blank", async () => {
    const { retrieveRelevantChunks } = await import("../rag");
    expect(await retrieveRelevantChunks("")).toBe("");
    expect(await retrieveRelevantChunks("   ")).toBe("");
    expect(embedTextMock).not.toHaveBeenCalled();
  });
});
