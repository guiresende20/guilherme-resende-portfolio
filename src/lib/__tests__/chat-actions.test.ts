import { describe, it, expect } from "vitest";
import { validateChatActions } from "../chat-actions";

describe("validateChatActions", () => {
  it("returns empty array for non-array input", () => {
    expect(validateChatActions(null)).toEqual([]);
    expect(validateChatActions(undefined)).toEqual([]);
    expect(validateChatActions("not array")).toEqual([]);
    expect(validateChatActions({ type: "link" })).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(validateChatActions([])).toEqual([]);
  });

  it("preserves a valid link to https URL", () => {
    const result = validateChatActions([
      { type: "link", label: "LinkedIn", url: "https://www.linkedin.com/in/guilhermeresende/" },
    ]);
    expect(result).toEqual([
      { type: "link", label: "LinkedIn", url: "https://www.linkedin.com/in/guilhermeresende/" },
    ]);
  });

  it("drops link with non-https protocol", () => {
    const result = validateChatActions([
      { type: "link", label: "phishing", url: "http://evil.example/" },
      { type: "link", label: "js", url: "javascript:alert(1)" },
      { type: "link", label: "data", url: "data:text/html,<script>alert(1)</script>" },
      { type: "link", label: "file", url: "file:///etc/passwd" },
    ]);
    expect(result).toEqual([]);
  });

  it("drops link without url", () => {
    const result = validateChatActions([{ type: "link", label: "no url" }]);
    expect(result).toEqual([]);
  });

  it("preserves video on allowed host", () => {
    const result = validateChatActions([
      { type: "video", label: "YT", url: "https://www.youtube.com/embed/abc123" },
      { type: "video", label: "YTnc", url: "https://www.youtube-nocookie.com/embed/abc123" },
      { type: "video", label: "Vimeo", url: "https://player.vimeo.com/video/123" },
    ]);
    expect(result).toHaveLength(3);
  });

  it("drops video on disallowed host", () => {
    const result = validateChatActions([
      { type: "video", label: "evil", url: "https://evil.example/video.mp4" },
      { type: "video", label: "ytlookalike", url: "https://youtube.com.evil.example/" },
    ]);
    expect(result).toEqual([]);
  });

  it("preserves whatsapp with wa.me URL only", () => {
    const result = validateChatActions([
      { type: "whatsapp", label: "WA", url: "https://wa.me/5551997925092" },
    ]);
    expect(result).toHaveLength(1);
  });

  it("drops whatsapp pointing elsewhere", () => {
    const result = validateChatActions([
      { type: "whatsapp", label: "WA", url: "https://evil.example/" },
      { type: "whatsapp", label: "WA", url: "https://wa.me.evil.example/" },
    ]);
    expect(result).toEqual([]);
  });

  it("preserves email with mailto", () => {
    const result = validateChatActions([
      { type: "email", label: "Email", url: "mailto:guiresende20@gmail.com" },
    ]);
    expect(result).toHaveLength(1);
  });

  it("drops email with non-mailto URL", () => {
    const result = validateChatActions([
      { type: "email", label: "Email", url: "https://evil.example/" },
    ]);
    expect(result).toEqual([]);
  });

  it("preserves scroll with valid CSS id", () => {
    const result = validateChatActions([
      { type: "scroll", label: "Formação", section: "formacao" },
      { type: "scroll", label: "About", section: "about-me_section" },
    ]);
    expect(result).toHaveLength(2);
  });

  it("drops scroll with invalid section id", () => {
    const result = validateChatActions([
      { type: "scroll", label: "x", section: "has space" },
      { type: "scroll", label: "x", section: "has/slash" },
      { type: "scroll", label: "x", section: "" },
      { type: "scroll", label: "x", section: "1starts-with-digit" },
      { type: "scroll", label: "x" },
    ]);
    expect(result).toEqual([]);
  });

  it("preserves download_cv with allowed cv_type", () => {
    for (const cv_type of ["ux", "academic", "innovation", "full"] as const) {
      const result = validateChatActions([{ type: "download_cv", label: "CV", cv_type }]);
      expect(result).toHaveLength(1);
    }
  });

  it("drops download_cv with bad cv_type", () => {
    const result = validateChatActions([
      { type: "download_cv", label: "CV", cv_type: "evil" },
      { type: "download_cv", label: "CV" },
    ]);
    expect(result).toEqual([]);
  });

  it("drops unknown type", () => {
    const result = validateChatActions([
      { type: "iframe", label: "evil", url: "https://evil.example/" },
      { type: "script", label: "evil", url: "https://evil.example/" },
    ]);
    expect(result).toEqual([]);
  });

  it("drops actions with non-string label", () => {
    const result = validateChatActions([
      { type: "link", label: 123, url: "https://example.com/" },
      { type: "link", url: "https://example.com/" },
    ]);
    expect(result).toEqual([]);
  });

  it("drops actions with oversized label", () => {
    const longLabel = "a".repeat(200);
    const result = validateChatActions([
      { type: "link", label: longLabel, url: "https://example.com/" },
    ]);
    expect(result).toEqual([]);
  });

  it("preserves valid actions and drops invalid ones in the same input", () => {
    const result = validateChatActions([
      { type: "link", label: "good", url: "https://example.com/" },
      { type: "link", label: "bad", url: "javascript:alert(1)" },
      { type: "scroll", label: "good", section: "formacao" },
    ]);
    expect(result).toEqual([
      { type: "link", label: "good", url: "https://example.com/" },
      { type: "scroll", label: "good", section: "formacao" },
    ]);
  });

  it("caps to a sane max number of actions", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      type: "link" as const,
      label: `link-${i}`,
      url: "https://example.com/",
    }));
    const result = validateChatActions(many);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
