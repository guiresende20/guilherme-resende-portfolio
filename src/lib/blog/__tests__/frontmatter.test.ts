import { describe, it, expect } from "vitest";
import { parsePost } from "../frontmatter";

describe("parsePost", () => {
  it("extracts frontmatter and body", () => {
    const raw = `---
title: Hello World
date: 2026-05-16
lang: pt
tags: [a, b]
draft: false
---

# Hello

Body here.`;
    const result = parsePost(raw, "hello.md");
    expect(result.meta.title).toBe("Hello World");
    expect(result.meta.date).toBe("2026-05-16");
    expect(result.meta.lang).toBe("pt");
    expect(result.meta.tags).toEqual(["a", "b"]);
    expect(result.meta.draft).toBe(false);
    expect(result.meta.slug).toBe("hello");
    expect(result.body).toContain("# Hello");
  });

  it("uses filename as default slug", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\nbody`;
    const result = parsePost(raw, "my-post.md");
    expect(result.meta.slug).toBe("my-post");
  });

  it("respects explicit slug", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\nslug: custom\n---\nbody`;
    const result = parsePost(raw, "different-filename.md");
    expect(result.meta.slug).toBe("custom");
  });

  it("defaults draft to false", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\nbody`;
    const result = parsePost(raw, "x.md");
    expect(result.meta.draft).toBe(false);
  });

  it("defaults featured to false", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\nbody`;
    const result = parsePost(raw, "x.md");
    expect(result.meta.featured).toBe(false);
  });

  it("computes reading time from body", () => {
    const words = "word ".repeat(400).trim();
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\n${words}`;
    const result = parsePost(raw, "x.md");
    expect(result.meta.readingTimeMin).toBe(2); // 400 / 200 = 2
  });
});
