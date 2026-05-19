import { describe, it, expect } from "vitest";
import { slugify } from "../frontmatter";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips Portuguese accents via NFD", () => {
    expect(slugify("Por trás do blog")).toBe("por-tras-do-blog");
    expect(slugify("João é ótimo")).toBe("joao-e-otimo");
    expect(slugify("Coração")).toBe("coracao");
  });

  it("replaces punctuation and special chars with hyphens", () => {
    expect(slugify("Hello, world!!!")).toBe("hello-world");
    expect(slugify("100% Java")).toBe("100-java");
    expect(slugify("a/b/c")).toBe("a-b-c");
  });

  it("collapses sequences of separators into a single hyphen", () => {
    expect(slugify("a   b---c")).toBe("a-b-c");
    expect(slugify("a , b , c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("!!hi!!")).toBe("hi");
  });

  it("returns empty string for input with no alphanumerics", () => {
    expect(slugify("???")).toBe("");
    expect(slugify("---")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("preserves digits", () => {
    expect(slugify("O que aprendi em 2024")).toBe("o-que-aprendi-em-2024");
  });

  it("handles unicode emoji by stripping", () => {
    expect(slugify("Hello 👋 world")).toBe("hello-world");
  });
});
