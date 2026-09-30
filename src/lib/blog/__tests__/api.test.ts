import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPostList } from "../api";

describe("fetchPostList", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ posts: [], cached: true }),
      })
    );
  });

  it("calls /api/blog/list with no query string when lang is omitted", async () => {
    await fetchPostList();
    expect(fetch).toHaveBeenCalledWith("/api/blog/list");
  });

  it("calls /api/blog/list with no query string when lang is 'pt'", async () => {
    await fetchPostList("pt");
    expect(fetch).toHaveBeenCalledWith("/api/blog/list");
  });

  it("appends ?lang=en when lang is 'en'", async () => {
    await fetchPostList("en");
    expect(fetch).toHaveBeenCalledWith("/api/blog/list?lang=en");
  });

  it("appends ?lang=es when lang is 'es'", async () => {
    await fetchPostList("es");
    expect(fetch).toHaveBeenCalledWith("/api/blog/list?lang=es");
  });
});
