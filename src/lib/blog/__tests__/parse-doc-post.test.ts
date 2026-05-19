import { describe, it, expect } from "vitest";
import { parseDocPost } from "../frontmatter";

const CREATED = "2026-05-18T10:30:00.000Z";

describe("parseDocPost — tags line", () => {
  it("extracts tags from first line and removes it from body", () => {
    const raw = "Tags: ia, blog, meta\n\nCorpo do post.";
    const r = parseDocPost(raw, "Meu post", CREATED);
    expect(r.meta.tags).toEqual(["ia", "blog", "meta"]);
    expect(r.body).toBe("Corpo do post.");
  });

  it("accepts 'Tag:' (singular)", () => {
    const raw = "Tag: solo\n\nCorpo.";
    expect(parseDocPost(raw, "x", CREATED).meta.tags).toEqual(["solo"]);
  });

  it("accepts 'TAGS:' (uppercase)", () => {
    const raw = "TAGS: a, b\n\nCorpo.";
    expect(parseDocPost(raw, "x", CREATED).meta.tags).toEqual(["a", "b"]);
  });

  it("tolerates spaces and trims values", () => {
    const raw = "Tags : a, b ,, c, \n\nCorpo.";
    expect(parseDocPost(raw, "x", CREATED).meta.tags).toEqual(["a", "b", "c"]);
  });

  it("with no Tags line, returns empty tags and intact body", () => {
    const raw = "Primeira linha sem tags.\n\nSegunda.";
    const r = parseDocPost(raw, "x", CREATED);
    expect(r.meta.tags).toEqual([]);
    expect(r.body).toBe("Primeira linha sem tags.\n\nSegunda.");
  });

  it("empty Tags value yields empty tags but still strips the line", () => {
    const raw = "Tags:\n\nCorpo.";
    const r = parseDocPost(raw, "x", CREATED);
    expect(r.meta.tags).toEqual([]);
    expect(r.body).toBe("Corpo.");
  });

  it("does not match Tags mid-body", () => {
    const raw = "Intro.\n\nTags: not real.";
    const r = parseDocPost(raw, "x", CREATED);
    expect(r.meta.tags).toEqual([]);
    expect(r.body).toBe("Intro.\n\nTags: not real.");
  });
});

describe("parseDocPost — derived fields", () => {
  it("uses driveName as title", () => {
    expect(parseDocPost("body", "Pensando em design", CREATED).meta.title).toBe(
      "Pensando em design"
    );
  });

  it("derives slug via slugify(driveName)", () => {
    expect(parseDocPost("body", "Por trás do blog", CREATED).meta.slug).toBe(
      "por-tras-do-blog"
    );
  });

  it("derives date from createdTime slice 0..10", () => {
    expect(parseDocPost("body", "x", "2026-05-18T10:30:00.000Z").meta.date).toBe(
      "2026-05-18"
    );
  });

  it("hardcodes lang to pt, draft/featured to false, cover undefined", () => {
    const m = parseDocPost("body", "x", CREATED).meta;
    expect(m.lang).toBe("pt");
    expect(m.draft).toBe(false);
    expect(m.featured).toBe(false);
    expect(m.cover).toBeUndefined();
  });

  it("computes readingTimeMin", () => {
    const words = Array.from({ length: 400 }, () => "palavra").join(" ");
    expect(parseDocPost(words, "x", CREATED).meta.readingTimeMin).toBe(2);
  });
});

describe("parseDocPost — excerpt", () => {
  it("uses first paragraph after stripping tags", () => {
    const raw = "Tags: a\n\nPrimeiro parágrafo curto.\n\nSegundo.";
    expect(parseDocPost(raw, "x", CREATED).meta.excerpt).toBe(
      "Primeiro parágrafo curto."
    );
  });

  it("truncates long excerpts at word boundary with ellipsis", () => {
    const long = "palavra ".repeat(50).trim();
    const r = parseDocPost(long, "x", CREATED);
    expect(r.meta.excerpt!.length).toBeLessThanOrEqual(201);
    expect(r.meta.excerpt!.endsWith("…")).toBe(true);
    expect(r.meta.excerpt!.endsWith(" …")).toBe(false);
  });

  it("uses whole body if no paragraph separator", () => {
    expect(parseDocPost("Linha única.", "x", CREATED).meta.excerpt).toBe(
      "Linha única."
    );
  });

  it("empty body yields empty excerpt", () => {
    expect(parseDocPost("", "x", CREATED).meta.excerpt).toBe("");
  });

  it("with only a tags line, excerpt is empty", () => {
    expect(parseDocPost("Tags: a", "x", CREATED).meta.excerpt).toBe("");
  });
});

describe("parseDocPost — error cases", () => {
  it("throws when slug derivation yields empty string", () => {
    expect(() => parseDocPost("body", "???", CREATED)).toThrow(/slug/i);
  });
});
