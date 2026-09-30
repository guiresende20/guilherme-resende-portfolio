import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeTranslatedTitles, translateTitles, type TranslatedTitle } from "../blog-list-translate";
import type { PostMeta } from "../../../../src/lib/blog/frontmatter";

const generateContentMock = vi.fn();

vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: generateContentMock };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

function meta(partial: Partial<PostMeta>): PostMeta {
  return {
    slug: "a",
    title: "Título original",
    date: "2026-01-01",
    lang: "pt",
    tags: [],
    excerpt: "Resumo original",
    draft: false,
    featured: false,
    readingTimeMin: 1,
    ...partial,
  };
}

describe("mergeTranslatedTitles", () => {
  it("replaces title and excerpt for a slug present in translations", () => {
    const translations = new Map<string, TranslatedTitle>([
      ["a", { title: "Original title", excerpt: "Original summary" }],
    ]);
    const [result] = mergeTranslatedTitles([meta({ slug: "a" })], translations);
    expect(result.title).toBe("Original title");
    expect(result.excerpt).toBe("Original summary");
  });

  it("leaves meta unchanged when slug is not in translations", () => {
    const [result] = mergeTranslatedTitles([meta({ slug: "b" })], new Map());
    expect(result.title).toBe("Título original");
    expect(result.excerpt).toBe("Resumo original");
  });

  it("falls back to the original excerpt when the translated entry has none", () => {
    const translations = new Map<string, TranslatedTitle>([
      ["a", { title: "Original title" }],
    ]);
    const [result] = mergeTranslatedTitles([meta({ slug: "a" })], translations);
    expect(result.title).toBe("Original title");
    expect(result.excerpt).toBe("Resumo original");
  });

  it("does not mutate the input metas array", () => {
    const original = meta({ slug: "a" });
    const translations = new Map<string, TranslatedTitle>([
      ["a", { title: "Original title" }],
    ]);
    mergeTranslatedTitles([original], translations);
    expect(original.title).toBe("Título original");
  });
});

describe("translateTitles", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("returns an empty map and never calls the API for empty input", async () => {
    const result = await translateTitles([], "en");
    expect(result.size).toBe(0);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("returns an empty map when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.size).toBe(0);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("parses a valid JSON array response into a Map keyed by slug", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            { slug: "a", title: "Original title", excerpt: "Original summary" },
          ]),
      },
    });
    const result = await translateTitles(
      [{ slug: "a", title: "Título", excerpt: "Resumo" }],
      "en"
    );
    expect(result.get("a")).toEqual({ title: "Original title", excerpt: "Original summary" });
  });

  it("omits excerpt when the model response doesn't include one", async () => {
    generateContentMock.mockResolvedValue({
      response: { text: () => JSON.stringify([{ slug: "a", title: "Original title" }]) },
    });
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.get("a")).toEqual({ title: "Original title", excerpt: undefined });
  });

  it("extracts the JSON array even if the model wraps it in commentary", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () => 'Here you go:\n```json\n[{"slug":"a","title":"Original title"}]\n```',
      },
    });
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.get("a")?.title).toBe("Original title");
  });

  it("returns an empty map when the model response is not valid JSON", async () => {
    generateContentMock.mockResolvedValue({ response: { text: () => "not json at all" } });
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.size).toBe(0);
  });

  it("returns an empty map when the API call rejects", async () => {
    generateContentMock.mockRejectedValue(new Error("429 quota"));
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.size).toBe(0);
  });
});
