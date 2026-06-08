import { describe, it, expect, beforeEach } from "vitest";
import { __resetAerolitoCacheForTests, appendAerolitoChunk, searchAerolito, resetAerolitoIndex, getAerolitoChunkCount } from "../aerolito-vector";

beforeEach(() => __resetAerolitoCacheForTests());

describe("aerolito-vector (no blobs env = no-op)", () => {
  it("appendAerolitoChunk does not throw when blobs env missing", async () => {
    await expect(appendAerolitoChunk({
      id: "11111111-1111-1111-1111-111111111111",
      text: "P: x\nR: y",
      vector: [0.1, 0.2, 0.3],
      questionIdx: 1,
      createdAt: new Date().toISOString(),
    })).resolves.not.toThrow();
  });

  it("searchAerolito returns empty when blobs env missing", async () => {
    const hits = await searchAerolito([0.1, 0.2, 0.3], { k: 5, threshold: 0.5 });
    expect(hits).toEqual([]);
  });

  it("resetAerolitoIndex is idempotent without blobs", async () => {
    await expect(resetAerolitoIndex()).resolves.not.toThrow();
  });

  it("getAerolitoChunkCount returns 0 without blobs", async () => {
    expect(await getAerolitoChunkCount()).toBe(0);
  });
});
