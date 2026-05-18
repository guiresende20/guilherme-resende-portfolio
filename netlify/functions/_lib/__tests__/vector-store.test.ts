import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory Blobs mock
const blobStore = new Map<string, unknown>();
const getMock = vi.fn();
const setJSONMock = vi.fn();
const deleteMock = vi.fn();
const listMock = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: getMock,
    setJSON: setJSONMock,
    delete: deleteMock,
    list: listMock,
    set: vi.fn(),
  })),
}));

beforeEach(async () => {
  blobStore.clear();
  getMock.mockReset();
  setJSONMock.mockReset();
  deleteMock.mockReset();
  listMock.mockReset();
  getMock.mockImplementation(async (key: string) => blobStore.get(key) ?? null);
  setJSONMock.mockImplementation(async (key: string, value: unknown) => {
    blobStore.set(key, value);
  });
  deleteMock.mockImplementation(async (key: string) => {
    blobStore.delete(key);
  });
  const mod = await import("../vector-store");
  mod.__resetCacheForTests();
});

const v = (dim: number, fillIndex: number): number[] => {
  const arr = new Array(dim).fill(0);
  arr[fillIndex] = 1;
  return arr;
};

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", async () => {
    const { cosineSimilarity } = await import("../vector-store");
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });
  it("returns 0 for orthogonal vectors", async () => {
    const { cosineSimilarity } = await import("../vector-store");
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it("returns -1 for opposite vectors", async () => {
    const { cosineSimilarity } = await import("../vector-store");
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });
});

describe("loadIndex", () => {
  it("returns empty chunks when blob missing", async () => {
    const { loadIndex } = await import("../vector-store");
    const idx = await loadIndex();
    expect(idx.chunks).toEqual([]);
  });

  it("caches in memory after first load", async () => {
    const { loadIndex } = await import("../vector-store");
    blobStore.set("embeddings/posts-index.json", { chunks: [{ slug: "a", chunkIdx: 0, text: "x", headingPath: "", sourceTitle: "A", vector: [1, 0] }] });
    await loadIndex();
    await loadIndex();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("returns empty when JSON is corrupt", async () => {
    const { loadIndex } = await import("../vector-store");
    getMock.mockResolvedValue("not json");
    const idx = await loadIndex();
    expect(idx.chunks).toEqual([]);
  });
});

describe("replacePostChunks / removePost", () => {
  it("inserts chunks for a new slug", async () => {
    const { replacePostChunks, loadIndex } = await import("../vector-store");
    await replacePostChunks("hello", [
      { slug: "hello", chunkIdx: 0, text: "t1", headingPath: "", sourceTitle: "Hello", vector: v(8, 0) },
      { slug: "hello", chunkIdx: 1, text: "t2", headingPath: "", sourceTitle: "Hello", vector: v(8, 1) },
    ]);
    const idx = await loadIndex();
    expect(idx.chunks).toHaveLength(2);
  });

  it("replaces existing chunks of the same slug", async () => {
    const { replacePostChunks, loadIndex } = await import("../vector-store");
    await replacePostChunks("hello", [
      { slug: "hello", chunkIdx: 0, text: "old", headingPath: "", sourceTitle: "Hello", vector: v(8, 0) },
    ]);
    await replacePostChunks("hello", [
      { slug: "hello", chunkIdx: 0, text: "new", headingPath: "", sourceTitle: "Hello", vector: v(8, 1) },
    ]);
    const idx = await loadIndex();
    expect(idx.chunks).toHaveLength(1);
    expect(idx.chunks[0].text).toBe("new");
  });

  it("does not touch chunks of other slugs", async () => {
    const { replacePostChunks, loadIndex } = await import("../vector-store");
    await replacePostChunks("a", [{ slug: "a", chunkIdx: 0, text: "ta", headingPath: "", sourceTitle: "A", vector: v(8, 0) }]);
    await replacePostChunks("b", [{ slug: "b", chunkIdx: 0, text: "tb", headingPath: "", sourceTitle: "B", vector: v(8, 1) }]);
    const idx = await loadIndex();
    expect(idx.chunks.map((c) => c.slug).sort()).toEqual(["a", "b"]);
  });

  it("removePost removes only specified slug", async () => {
    const { replacePostChunks, removePost, loadIndex } = await import("../vector-store");
    await replacePostChunks("a", [{ slug: "a", chunkIdx: 0, text: "ta", headingPath: "", sourceTitle: "A", vector: v(8, 0) }]);
    await replacePostChunks("b", [{ slug: "b", chunkIdx: 0, text: "tb", headingPath: "", sourceTitle: "B", vector: v(8, 1) }]);
    await removePost("a");
    const idx = await loadIndex();
    expect(idx.chunks.map((c) => c.slug)).toEqual(["b"]);
  });
});

describe("searchSimilar", () => {
  it("returns hits ordered by score desc", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "x", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 1, text: "y", headingPath: "", sourceTitle: "A", vector: v(8, 1) },
    ]);
    const hits = await searchSimilar(v(8, 1), { k: 5, threshold: 0, maxPerPost: 5 });
    expect(hits[0].text).toBe("y");
    expect(hits[0].score).toBeCloseTo(1, 6);
  });

  it("filters by threshold", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "x", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
    ]);
    const hits = await searchSimilar(v(8, 1), { k: 5, threshold: 0.5, maxPerPost: 5 });
    expect(hits).toEqual([]);
  });

  it("respects maxPerPost", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "x0", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 1, text: "x1", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 2, text: "x2", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
    ]);
    await replacePostChunks("b", [
      { slug: "b", chunkIdx: 0, text: "y0", headingPath: "", sourceTitle: "B", vector: v(8, 0) },
    ]);
    const hits = await searchSimilar(v(8, 0), { k: 5, threshold: 0, maxPerPost: 2 });
    expect(hits.filter((h) => h.slug === "a")).toHaveLength(2);
    expect(hits.filter((h) => h.slug === "b")).toHaveLength(1);
  });

  it("ignores chunks with mismatched vector dimension", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    await replacePostChunks("a", [
      { slug: "a", chunkIdx: 0, text: "ok", headingPath: "", sourceTitle: "A", vector: v(8, 0) },
      { slug: "a", chunkIdx: 1, text: "bad", headingPath: "", sourceTitle: "A", vector: v(16, 0) },
    ]);
    const hits = await searchSimilar(v(8, 0), { k: 5, threshold: 0, maxPerPost: 5 });
    expect(hits.map((h) => h.text)).toEqual(["ok"]);
  });

  it("returns top-k at most", async () => {
    const { replacePostChunks, searchSimilar } = await import("../vector-store");
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      slug: `s${i}`,
      chunkIdx: 0,
      text: `t${i}`,
      headingPath: "",
      sourceTitle: `S${i}`,
      vector: v(8, 0),
    }));
    for (const c of chunks) await replacePostChunks(c.slug, [c]);
    const hits = await searchSimilar(v(8, 0), { k: 3, threshold: 0, maxPerPost: 5 });
    expect(hits).toHaveLength(3);
  });
});
