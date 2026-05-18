import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK at module level
const embedContentMock = vi.fn();
const batchEmbedContentsMock = vi.fn();

vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return {
        embedContent: embedContentMock,
        batchEmbedContents: batchEmbedContentsMock,
      };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

beforeEach(() => {
  embedContentMock.mockReset();
  batchEmbedContentsMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("embedText", () => {
  it("returns a 768-dim vector", async () => {
    const { embedText, EMBEDDING_DIM } = await import("../embeddings");
    embedContentMock.mockResolvedValue({
      embedding: { values: Array(EMBEDDING_DIM).fill(0.1) },
    });
    const vec = await embedText("hello");
    expect(vec).toHaveLength(EMBEDDING_DIM);
    expect(embedContentMock).toHaveBeenCalledOnce();
  });

  it("throws when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.resetModules();
    const { embedText } = await import("../embeddings");
    await expect(embedText("hi")).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("retries once on 429", async () => {
    const { embedText, EMBEDDING_DIM } = await import("../embeddings");
    embedContentMock
      .mockRejectedValueOnce(Object.assign(new Error("429 Too Many"), { status: 429 }))
      .mockResolvedValueOnce({ embedding: { values: Array(EMBEDDING_DIM).fill(0.2) } });
    const vec = await embedText("retry me");
    expect(vec).toHaveLength(EMBEDDING_DIM);
    expect(embedContentMock).toHaveBeenCalledTimes(2);
  });
});

describe("embedBatch", () => {
  it("returns N vectors for N inputs", async () => {
    const { embedBatch, EMBEDDING_DIM } = await import("../embeddings");
    batchEmbedContentsMock.mockResolvedValue({
      embeddings: [
        { values: Array(EMBEDDING_DIM).fill(0.1) },
        { values: Array(EMBEDDING_DIM).fill(0.2) },
        { values: Array(EMBEDDING_DIM).fill(0.3) },
      ],
    });
    const vecs = await embedBatch(["a", "b", "c"]);
    expect(vecs).toHaveLength(3);
    expect(vecs[0]).toHaveLength(EMBEDDING_DIM);
  });

  it("returns empty array for empty input", async () => {
    const { embedBatch } = await import("../embeddings");
    expect(await embedBatch([])).toEqual([]);
    expect(batchEmbedContentsMock).not.toHaveBeenCalled();
  });

  it("rejects batches larger than 100", async () => {
    const { embedBatch } = await import("../embeddings");
    const big = Array(101).fill("x");
    await expect(embedBatch(big)).rejects.toThrow(/batch.*100/i);
  });
});
