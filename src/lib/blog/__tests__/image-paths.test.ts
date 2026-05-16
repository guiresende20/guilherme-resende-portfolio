import { describe, it, expect } from "vitest";
import { rewriteImagePaths } from "../image-paths";

describe("rewriteImagePaths", () => {
  it("rewrites relative image", () => {
    const input = "Look: ![alt](cover.webp) end.";
    const output = rewriteImagePaths(input);
    expect(output).toBe("Look: ![alt](/api/blog/image/cover.webp) end.");
  });

  it("leaves absolute https URLs untouched", () => {
    const input = "![x](https://example.com/img.png)";
    expect(rewriteImagePaths(input)).toBe(input);
  });

  it("leaves protocol-relative URLs untouched", () => {
    const input = "![x](//cdn.com/img.png)";
    expect(rewriteImagePaths(input)).toBe(input);
  });

  it("leaves data URIs untouched", () => {
    const input = "![x](data:image/png;base64,abc)";
    expect(rewriteImagePaths(input)).toBe(input);
  });

  it("handles multiple images in one document", () => {
    const input = "![a](one.png) and ![b](two.jpg)";
    expect(rewriteImagePaths(input)).toBe(
      "![a](/api/blog/image/one.png) and ![b](/api/blog/image/two.jpg)"
    );
  });

  it("ignores image-like text inside code fences", () => {
    const input = "```\n![not-an-image](x.png)\n```";
    expect(rewriteImagePaths(input)).toBe(input);
  });
});
