import { describe, it, expect } from "vitest";
import { chunk, estimateTokens } from "../chunker";

describe("estimateTokens", () => {
  it("approximates 4 chars per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(2000))).toBe(500);
  });
});

describe("chunk", () => {
  it("returns empty array for empty body", () => {
    expect(chunk("")).toEqual([]);
    expect(chunk("   \n\n  ")).toEqual([]);
  });

  it("returns single chunk when body is small", () => {
    const body = "Curto e doce.\n\nApenas dois parágrafos.";
    const result = chunk(body, { targetTokens: 500, overlap: 80 });
    expect(result).toHaveLength(1);
    expect(result[0].idx).toBe(0);
    expect(result[0].text).toContain("Curto e doce");
    expect(result[0].text).toContain("dois parágrafos");
    expect(result[0].headingPath).toBe("");
  });

  it("splits long body into multiple chunks with overlap", () => {
    const para = "Lorem ipsum ".repeat(50) + ".";
    const body = Array.from({ length: 8 }, () => para).join("\n\n");
    const result = chunk(body, { targetTokens: 500, overlap: 80 });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].idx).toBe(0);
    expect(result[1].idx).toBe(1);
    // Overlap: some tail of chunk[0] should appear inside chunk[1].
    // Use a fingerprint of the last words of chunk[0].
    const lastWords = result[0].text.split(/\s+/).slice(-5).join(" ");
    expect(result[1].text).toContain(lastWords);
  });

  it("preserves heading path in chunks", () => {
    const body = `# Top

## Seção A

Texto da A.

### Subseção A1

Texto da A1.

## Seção B

Texto da B.`;
    const result = chunk(body, { targetTokens: 500, overlap: 80 });
    expect(result).toHaveLength(1); // small enough to fit
    expect(result[0].text).toContain("## Seção A");
  });

  it("attaches headingPath to chunks inside a section", () => {
    const longText = "palavra ".repeat(200);
    const body = `# Top

## Seção A

${longText}

### Subseção A1

${longText}

## Seção B

${longText}`;
    const result = chunk(body, { targetTokens: 200, overlap: 40 });
    expect(result.length).toBeGreaterThan(1);
    // At least one chunk should have a non-empty headingPath
    expect(result.some((c) => c.headingPath.includes("Seção"))).toBe(true);
  });

  it("does not split inside fenced code blocks", () => {
    const code = "```\n" + "linha ".repeat(100) + "\n```";
    const body = `Antes.\n\n${code}\n\nDepois.`;
    const result = chunk(body, { targetTokens: 100, overlap: 20 });
    // Each chunk that contains "```" should contain a matching closing "```"
    for (const c of result) {
      const opens = (c.text.match(/```/g) || []).length;
      expect(opens % 2).toBe(0);
    }
  });

  it("assigns sequential idx starting at 0", () => {
    const body = "Lorem ".repeat(2000);
    const result = chunk(body, { targetTokens: 200, overlap: 40 });
    result.forEach((c, i) => expect(c.idx).toBe(i));
  });
});
