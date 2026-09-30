import { describe, it, expect } from "vitest";
import { mergeTranslatedTitles, type TranslatedTitle } from "../blog-list-translate";
import type { PostMeta } from "../../../../src/lib/blog/frontmatter";

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
